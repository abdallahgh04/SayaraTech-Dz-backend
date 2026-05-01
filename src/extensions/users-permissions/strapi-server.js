'use strict';

// ── مساعد: بناء كائن المستخدم للـ response ──────────────────────────────────
function buildUserResponse(user, role) {
  return {
    id:            user.id,
    username:      user.username,
    email:         user.email,
    confirmed:     user.confirmed,
    blocked:       user.blocked,
    vendeurStatus: user.vendeurStatus || null,
    role: role
      ? { id: role.id, name: role.name, type: role.type }
      : null,
  };
}

// ── مساعد: التحقق من صيغة الإيميل ──────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = (plugin) => {

  const originalCallback = plugin.controllers.auth.callback;

  // ── التسجيل ─────────────────────────────────────────────────────────────
  plugin.controllers.auth.register = async (ctx) => {
    try {
      const {
        username, email, password,
        isVendor,
        firstName, lastName, phone, birthDate, gender,
      } = ctx.request.body;

      // ── 1. التحقق من الحقول المطلوبة ──────────────────────
      if (!username || !email || !password) {
        ctx.status = 400;
        ctx.body = { error: { message: 'username و email و password مطلوبة' } };
        return;
      }

      if (!isValidEmail(email)) {
        ctx.status = 400;
        ctx.body = { error: { message: 'صيغة البريد الإلكتروني غير صحيحة' } };
        return;
      }

      if (password.length < 6) {
        ctx.status = 400;
        ctx.body = { error: { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' } };
        return;
      }

      if (username.length < 3) {
        ctx.status = 400;
        ctx.body = { error: { message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' } };
        return;
      }

      // ── 2. التحقق من عدم تكرار الإيميل أو اليوزرنيم ──────
      const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { $or: [{ email: email.toLowerCase() }, { username }] },
      });

      if (existingUser) {
        ctx.status = 400;
        ctx.body = { error: { message: 'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل' } };
        return;
      }

      // ── 3. جلب الدور المناسب ──────────────────────────────
      // isVendor: true  → دور "vendeur"
      // isVendor: false → دور "acheteur"
      const roleName = isVendor ? 'vendeur' : 'acheteur';
      let assignedRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { name: roleName },
      });

      if (!assignedRole) {
        strapi.log.warn(`[register] Role "${roleName}" not found, falling back to "authenticated"`);
        assignedRole = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { type: 'authenticated' },
        });
        if (!assignedRole) {
          ctx.status = 500;
          ctx.body = { error: { message: 'خطأ في الخادم: لم يتم العثور على الدور' } };
          return;
        }
      }

      // ── 4. تشفير كلمة المرور وإنشاء المستخدم ─────────────
      const hashedPassword = await strapi.plugins['users-permissions'].services.user.hashPassword({ password });

      const newUser = await strapi.db.query('plugin::users-permissions.user').create({
        data: {
          username,
          email:         email.toLowerCase(),
          password:      hashedPassword,
          provider:      'local',
          confirmed:     true,
          blocked:       false,
          vendeurStatus: isVendor ? 'pending' : null,
          role:          assignedRole.id,
        },
      });

      // ── 5. إنشاء البروفايل إذا أُرسلت بيانات ─────────────
      if (firstName || lastName || phone) {
        try {
          await strapi.db.query('api::profil.profil').create({
            data: {
              firstName:   firstName   || null,
              lastName:    lastName    || null,
              phone:       phone       || null,
              birthDate:   birthDate   || null,
              gender:      gender      || null,
              user:        newUser.id,
              publishedAt: new Date(),
            },
          });
        } catch (profileErr) {
          // البروفايل اختياري — نسجّل الخطأ لكن لا نوقف التسجيل
          strapi.log.error('[register] Failed to create profil:', profileErr);
        }
      }

      // ── 6. توليد JWT والرد ────────────────────────────────
      const jwt = strapi.plugins['users-permissions'].services.jwt.issue({ id: newUser.id });

      ctx.status = 200;
      ctx.body = {
        jwt,
        user: buildUserResponse(newUser, assignedRole),
      };

    } catch (err) {
      strapi.log.error('[register] Unexpected error:', err);
      ctx.status = 500;
      ctx.body = { error: { message: 'حدث خطأ غير متوقع أثناء التسجيل' } };
    }
  };

  // ── تسجيل الدخول والـ OAuth callback ────────────────────────────────────
  plugin.controllers.auth.callback = async (ctx) => {
    const provider = ctx.params && ctx.params.provider;

    // ── تسجيل الدخول العادي (local) ───────────────────────────
    if (!provider || provider === 'local') {
      try {
        await originalCallback(ctx);

        // أضف الدور وvendeurStatus للـ response بعد نجاح تسجيل الدخول
        if (ctx.status === 200 && ctx.body && ctx.body.user) {
          const userId = ctx.body.user.id;
          const user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where:    { id: userId },
            populate: { role: true },
          });

          if (user) {
            ctx.body.user = buildUserResponse(user, user.role);
            // أعد إرفاق الـ jwt لأن buildUserResponse لا يتضمنه
            ctx.body.jwt = ctx.body.jwt;
          }
        }
      } catch (err) {
        // إذا كان الخطأ من Strapi (كلمة مرور خاطئة) نعيده كما هو
        if (ctx.status && ctx.status !== 200) return;
        strapi.log.error('[callback:local] Unexpected error:', err);
        ctx.status = 500;
        ctx.body = { error: { message: 'حدث خطأ أثناء تسجيل الدخول' } };
      }
      return;
    }

    // ── OAuth providers (Google, Facebook, ...) ────────────────
    try {
      await originalCallback(ctx);

      if (ctx.body && ctx.body.user) {
        const userId = ctx.body.user.id;
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where:    { id: userId },
          populate: { role: true },
        });

        if (user) {
          let updatedData = {};

          // تعيين vendeurStatus للمستخدمين الجدد عبر OAuth
          if (!user.vendeurStatus) {
            updatedData.vendeurStatus = 'pending';
          }

          // تعيين دور acheteur إذا كان الدور Authenticated (مستخدم جديد عبر OAuth)
          if (user.role && user.role.type === 'authenticated') {
            const acheteurRole = await strapi.db.query('plugin::users-permissions.role').findOne({
              where: { name: 'acheteur' },
            });
            if (acheteurRole) {
              updatedData.role = acheteurRole.id;
              user.role = acheteurRole; // تحديث محلي للـ response
            }
          }

          // تطبيق التحديثات إذا وجدت
          if (Object.keys(updatedData).length > 0) {
            const updated = await strapi.db.query('plugin::users-permissions.user').update({
              where: { id: userId },
              data:  updatedData,
            });
            user.vendeurStatus = updated.vendeurStatus;
          }

          ctx.body.user = buildUserResponse(user, user.role);
          ctx.body.jwt  = ctx.body.jwt;
        }
      }
    } catch (err) {
      strapi.log.error('[callback:oauth] Error:', err);
      ctx.status = 500;
      ctx.body = { error: { message: 'حدث خطأ أثناء تسجيل الدخول' } };
    }
  };

  return plugin;
};
