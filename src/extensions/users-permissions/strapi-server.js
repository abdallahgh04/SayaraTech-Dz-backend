'use strict';

module.exports = (plugin) => {

  // حفظ controllers الأصلية
  const originalRegister = plugin.controllers.auth.register;
  const originalCallback = plugin.controllers.auth.callback;

  plugin.controllers.auth.register = async (ctx) => {
    const { isVendor, firstName, lastName, phone, birthDate, gender } = ctx.request.body;

    // إذا مش vendor، نستخدم التسجيل العادي
    if (!isVendor) {
      return originalRegister(ctx);
    }

    // ── تسجيل Vendor ──────────────────────────────────────────
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

    // جلب دور Authenticated (الافتراضي)
    const defaultRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });

    if (!defaultRole) {
      ctx.status = 500;
      ctx.body = { error: { message: 'لم يتم العثور على الدور الافتراضي' } };
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
        vendeurStatus: 'pending',
        role: defaultRole.id,
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

    ctx.status = 200;
    ctx.body = {
      jwt,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        vendeurStatus: newUser.vendeurStatus,
        confirmed: newUser.confirmed,
      },
    };
  };

  // معالجة Google callback
  plugin.controllers.auth.callback = async (ctx) => {
    try {
      await originalCallback(ctx);

      // إذا نجح الـ callback وفيه user في الـ body
      if (ctx.body && ctx.body.user) {
        const userId = ctx.body.user.id;

        // تحقق إذا المستخدم ما عنده vendeurStatus، حطله pending
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
