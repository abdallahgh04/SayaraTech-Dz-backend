'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::product.product', ({ strapi }) => ({
  // ── Create: Vendeur فقط ──────────────────────────────
  async create(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    if (user.role.type !== 'vendeur' && user.role.type !== 'admin') {
      return ctx.forbidden('Only vendors can create products');
    }

    // إضافة vendeurId تلقائياً
    ctx.request.body.data = {
      ...ctx.request.body.data,
      vendeurId: user.id.toString(),
    };

    return super.create(ctx);
  },

  // ── Update: Vendeur يعدل منتجاته فقط ─────────────────
  async update(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // Admin يعدل كل شيء
    if (user.role.type === 'admin' || user.role.type === 'superadmin') {
      return super.update(ctx);
    }

    // Vendeur يعدل منتجاته فقط
    if (user.role.type === 'vendeur') {
      const product = await strapi.db.query('api::product.product').findOne({
        where: { id },
      });

      if (!product) {
        return ctx.notFound('Product not found');
      }

      if (product.vendeurId !== user.id.toString()) {
        return ctx.forbidden('You can only update your own products');
      }
    }

    return super.update(ctx);
  },

  // ── Delete: Vendeur يحذف منتجاته فقط ─────────────────
  async delete(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // Admin يحذف كل شيء
    if (user.role.type === 'admin' || user.role.type === 'superadmin') {
      return super.delete(ctx);
    }

    // Vendeur يحذف منتجاته فقط
    if (user.role.type === 'vendeur') {
      const product = await strapi.db.query('api::product.product').findOne({
        where: { id },
      });

      if (!product) {
        return ctx.notFound('Product not found');
      }

      if (product.vendeurId !== user.id.toString()) {
        return ctx.forbidden('You can only delete your own products');
      }
    }

    return super.delete(ctx);
  },
}));
