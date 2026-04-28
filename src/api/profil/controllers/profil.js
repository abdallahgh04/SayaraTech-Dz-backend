'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::profil.profil', ({ strapi }) => ({
  // ── Find: المستخدم يرى بروفايله فقط ────────────────────
  async find(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // Admin يرى كل البروفايلات
    if (user.role.type === 'admin' || user.role.type === 'superadmin') {
      return super.find(ctx);
    }

    // المستخدم يرى بروفايله فقط
    const profil = await strapi.db.query('api::profil.profil').findOne({
      where: { user: user.id },
      populate: { user: true },
    });

    ctx.body = profil ? { data: [profil], meta: {} } : { data: [], meta: {} };
  },

  // ── FindOne: المستخدم يرى بروفايله فقط ───────────────
  async findOne(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const profil = await strapi.db.query('api::profil.profil').findOne({
      where: { id },
      populate: { user: true },
    });

    if (!profil) {
      return ctx.notFound('Profil not found');
    }

    // Admin يرى كل شيء
    if (user.role.type === 'admin' || user.role.type === 'superadmin') {
      ctx.body = { data: profil, meta: {} };
      return;
    }

    // المستخدم يرى بروفايله فقط
    if (profil.user?.id !== user.id) {
      return ctx.forbidden('You can only access your own profile');
    }

    ctx.body = { data: profil, meta: {} };
  },

  // ── Update: المستخدم يعدل بروفايله فقط ────────────────
  async update(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const profil = await strapi.db.query('api::profil.profil').findOne({
      where: { id },
      populate: { user: true },
    });

    if (!profil) {
      return ctx.notFound('Profil not found');
    }

    // Admin يعدل كل شيء
    if (user.role.type === 'admin' || user.role.type === 'superadmin') {
      return super.update(ctx);
    }

    // المستخدم يعدل بروفايله فقط
    if (profil.user?.id !== user.id) {
      return ctx.forbidden('You can only update your own profile');
    }

    return super.update(ctx);
  },

  // ── Delete: المستخدم يحذف بروفايله فقط ────────────────
  async delete(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const profil = await strapi.db.query('api::profil.profil').findOne({
      where: { id },
      populate: { user: true },
    });

    if (!profil) {
      return ctx.notFound('Profil not found');
    }

    // Admin يحذف كل شيء
    if (user.role.type === 'admin' || user.role.type === 'superadmin') {
      return super.delete(ctx);
    }

    // المستخدم يحذف بروفايله فقط
    if (profil.user?.id !== user.id) {
      return ctx.forbidden('You can only delete your own profile');
    }

    return super.delete(ctx);
  },
}));
