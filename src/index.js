'use strict';

module.exports = {
  register({ strapi }) {},

  bootstrap({ strapi }) {
    strapi.server.router.get("/api/admin/users", async (ctx) => {
      try {
        const users = await strapi.db.query("plugin::users-permissions.user").findMany({
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
