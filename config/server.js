module.exports = ({ env }) => {
  console.log('>>> server.js loaded, APP_KEYS:', env('APP_KEYS'));
  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    app: {
      keys: [
        'K1xZ9yP4rTqv7sW2eHfD3aL8mN0bC6uF',
        'Qw2E4rT6yU8iO0pL1kJ3hG5fD7sA9zXc',
        'Zx1C3vB5nM7kL9oP0iU2yT4rE6wQ8sA',
        'As4D6fG8hJ0kL2pO3iU5yR7tE9wQ1zX'
      ],
    },
    webhooks: {
      populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
    },
  };
};
