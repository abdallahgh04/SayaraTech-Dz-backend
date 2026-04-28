'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::purchase.purchase', ({ strapi }) => ({
  // ── Create: إضافة user تلقائياً ──────────────────────
  async create(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // إضافة user تلقائياً
    ctx.request.body.data = {
      ...ctx.request.body.data,
      user: user.id,
    };

    return super.create(ctx);
  },

  // ── Find: المستخدم يرى طلباته فقط ────────────────────
  async find(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // Admin يرى كل الطلبات
    if (user.role.type === 'admin' || user.role.type === 'superadmin') {
      return super.find(ctx);
    }

    // Acheteur يرى طلباته فقط
    ctx.query = {
      ...ctx.query,
      filters: {
        ...ctx.query.filters,
        user: { id: user.id },
      },
    };

    return super.find(ctx);
  },

  // ── FindOne: المستخدم يرى طلبه فقط ───────────────────
  async findOne(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const purchase = await strapi.db.query('api::purchase.purchase').findOne({
      where: { id },
      populate: { user: true },
    });

    if (!purchase) {
      return ctx.notFound('Purchase not found');
    }

    // Admin يرى كل شيء
    if (user.role.type === 'admin' || user.role.type === 'superadmin') {
      ctx.body = purchase;
      return;
    }

    // المستخدم يرى طلبه فقط
    if (purchase.user?.id !== user.id) {
      return ctx.forbidden('You cannot access this purchase');
    }

    return super.findOne(ctx);
  },

  // ── Update: Vendeur يحدث حالة الطلب فقط ──────────────
  async update(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // Vendeur يحدث status فقط
    if (user.role.type === 'vendeur') {
      const allowedFields = ['status'];
      const requestedFields = Object.keys(ctx.request.body.data || {});
      
      const hasInvalidFields = requestedFields.some(f => !allowedFields.includes(f));
      if (hasInvalidFields) {
        return ctx.forbidden('Vendeur can only update status field');
      }
    }

    return super.update(ctx);
  },
}));
