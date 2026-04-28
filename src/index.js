'use strict';

module.exports = {
  register({ strapi }) {},

  async bootstrap({ strapi }) {
    // ── إنشاء Roles: Acheteur و Vendeur ──────────────────
    const existingRoles = await strapi.db.query('plugin::users-permissions.role').findMany();
    const roleNames = existingRoles.map(r => r.type);

    // إنشاء Acheteur إذا لم يكن موجوداً
    if (!roleNames.includes('acheteur')) {
      await strapi.db.query('plugin::users-permissions.role').create({
        data: {
          name: 'Acheteur',
          description: 'Role for buyers',
          type: 'acheteur',
        },
      });
      console.log('✅ Role "Acheteur" created');
    }

    // إنشاء Vendeur إذا لم يكن موجوداً
    if (!roleNames.includes('vendeur')) {
      await strapi.db.query('plugin::users-permissions.role').create({
        data: {
          name: 'Vendeur',
          description: 'Role for sellers',
          type: 'vendeur',
        },
      });
      console.log('✅ Role "Vendeur" created');
    }

    // ── Debug Routes ──────────────────────────────────────
    strapi.server.router.get("/api/debug/roles", async (ctx) => {
      try {
        const roles = await strapi.db.query('plugin::users-permissions.role').findMany();
        ctx.body = { roles: roles.map(r => ({ id: r.id, name: r.name, type: r.type })) };
      } catch (e) {
        ctx.body = { error: e.message };
      }
    });

    strapi.server.router.get("/api/debug/google", async (ctx) => {
      try {
        const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
        const grantConfig = await store.get({ key: 'grant' });
        ctx.body = {
          google: grantConfig && grantConfig.google ? {
            enabled: grantConfig.google.enabled,
            hasKey: !!grantConfig.google.key,
            hasSecret: !!grantConfig.google.secret,
            callbackURL: grantConfig.google.callback,
          } : 'not configured in DB',
        };
      } catch (e) {
        ctx.body = { error: e.message };
      }
    });

    strapi.server.router.get("/api/debug/google-error", async (ctx) => {
      try {
        const grant = strapi.server.app.middleware.find(m => m.name === 'grant' || (m && m.toString().includes('grant')));
        ctx.body = { grantMiddleware: !!grant };
      } catch(e) {
        ctx.body = { error: e.message, stack: e.stack };
      }
    });

    // ── Route: /api/admin/users ───────────────────────────
    strapi.server.router.get("/api/admin/users", async (ctx) => {
      try {
        // ── 1. التحقق من وجود Authorization header ──────────
        const authHeader = ctx.request.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          ctx.status = 401;
          ctx.body = { error: 'Unauthorized: missing token' };
          return;
        }

        const token = authHeader.split(' ')[1];

        // ── 2. التحقق من صحة الـ JWT ─────────────────────────
        let decoded;
        try {
          decoded = await strapi.plugins['users-permissions'].services.jwt.verify(token);
        } catch {
          ctx.status = 401;
          ctx.body = { error: 'Unauthorized: invalid token' };
          return;
        }

        // ── 3. التحقق أن المستخدم admin أو superAdmin ────────
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: decoded.id },
          populate: { role: true },
        });

        if (!user || !user.role) {
          ctx.status = 403;
          ctx.body = { error: 'Forbidden: user not found' };
          return;
        }

        const allowedRoles = ['admin', 'superadmin', 'Administrator'];
        if (!allowedRoles.includes(user.role.type) && !allowedRoles.includes(user.role.name)) {
          ctx.status = 403;
          ctx.body = { error: 'Forbidden: insufficient permissions' };
          return;
        }

        // ── 4. جلب جميع المستخدمين ───────────────────────────
        const users = await strapi.db.query('plugin::users-permissions.user').findMany({
          populate: { role: true },
        });

        ctx.body = users.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          createdAt: u.createdAt,
          blocked: u.blocked,
          vendeurStatus: u.vendeurStatus || null,
          role: u.role,
        }));

      } catch (e) {
        ctx.status = 500;
        ctx.body = { error: e.message };
      }
    });
  },
};
