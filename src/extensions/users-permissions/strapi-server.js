'use strict';

module.exports = (plugin) => {
  const originalRegister = plugin.controllers.auth.register;
  const originalCallback = plugin.controllers.auth.callback;

  plugin.controllers.auth.register = async (ctx) => {
    const { isVendor, firstName, lastName, phone, birthDate, gender } = ctx.request.body;
    const { username, email, password } = ctx.request.body;

    if (!username || !email || !password) {
      ctx.status = 400;
      ctx.body = { error: { message: 'username و email و password مطلوبة' } };
      return;
    }

    // التحقق من عدم تكرار الإيميل أو اليوزرنيم
    const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { $or: [{ email }, { username }] },
    });

    if (existingUser) {
      ctx.status = 400;
      ctx.body = { error: { message: 'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل' } };
      return;
    }

    // ── تحديد الـ role حسب isVendor ──────────────────────
    let role;
    
    if (isVendor) {
      role = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'vendeur' },
      });
      
      if (!role) {
        console.warn('⚠️ Role "vendeur" not found, falling back to authenticated');
      }
    } else {
      role = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'acheteur' },
      });
      
      if (!role) {
        console.warn('⚠️ Role "acheteur" not found, falling back to authenticated');
      }
    }

    // fallback إلى authenticated إذا لم يوجد
    if (!role) {
      role = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
      });
    }

    if (!role) {
      ctx.status = 500;
      ctx.body = { error: { message: 'لم يتم العثور على أي دور متاح. تأكد من إنشاء الأدوار في Strapi Admin.' } };
      return;
    }

    // تشفير كلمة المرور
    const hashedPassword = await strapi.plugins['users-permissions'].services.user.hashPassword({
      password,
    });

    // إنشاء المستخدم
    const newUser = await strapi.db.query('plugin::users-permissions.user').create({
      data: {
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        provider: 'local',
        confirmed: true,
        blocked: false,
        vendeurStatus: isVendor ? 'pending' : null,
        role: role.id,
      },
    });

    // إنشاء البروفايل المرتبط
    if (firstName || lastName || phone) {
      await strapi.db.query('api::profil.profil').create({
        data: {
          firstName: firstName || null,
          lastName: lastName || null,
          phone: phone || null,
          birthDate: birthDate || null,
          gender: gender || null,
          user: newUser.id,
          publishedAt: new Date(),
        },
      });
    }

    // توليد JWT
    const jwt = strapi.plugins['users-permissions'].services.jwt.issue({ id: newUser.id });

    // إرجاع المستخدم مع الـ role
    const userWithRole = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: newUser.id },
      populate: { role: true },
    });

    ctx.status = 200;
    ctx.body = {
      jwt,
      user: {
        id: userWithRole.id,
        username: userWithRole.username,
        email: userWithRole.email,
        vendeurStatus: userWithRole.vendeurStatus,
        confirmed: userWithRole.confirmed,
        role: userWithRole.role,
      },
    };
  };

  // معالجة Google callback
  plugin.controllers.auth.callback = async (ctx) => {
    try {
      await originalCallback(ctx);

      if (ctx.body && ctx.body.user) {
        const userId = ctx.body.user.id;

        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: userId },
        });

        if (user && !user.vendeurStatus) {
          await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: userId },
            data: { vendeurStatus: 'pending' },
          });
          ctx.body.user.vendeurStatus = 'pending';
        }
      }
    } catch (err) {
      strapi.log.error('Google callback error:', err);
      ctx.status = 500;
      ctx.body = { error: { message: 'حدث خطأ أثناء تسجيل الدخول بـ Google' } };
    }
  };

  return plugin;
};
