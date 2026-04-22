module.exports = ({ env }) => ({

  // ── Upload Cloudinary ─────────────────────────────────
  upload: {
    config: {
      provider: 'cloudinary',
      providerOptions: {
        cloud_name: env('CLOUDINARY_NAME'),
        api_key:    env('CLOUDINARY_KEY'),
        api_secret: env('CLOUDINARY_SECRET'),
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },

  // ── Import / Export ───────────────────────────────────
  'import-export-entries': {
    enabled: true,
  },

  // ── Users & Permissions (OAuth Google + Facebook) ─────
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: '7d',
      },
      providers: {
        google: {
          enabled:     true,
          icon:        'google',
          key:         '272608720224-1rntlnvobrf67timhrdvfe32hbk9ofot.apps.googleusercontent.com',
          secret:      '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',
          callbackURL: 'https://tranquil-transformation-production-5166.up.railway.app/api/connect/google/callback',
          scope: ['email', 'profile'],
        },
        facebook: {
          enabled:     env.bool('FACEBOOK_ENABLED', false),
          icon:        'facebook',
          key:         env('FACEBOOK_APP_ID',     ''),
          secret:      env('FACEBOOK_APP_SECRET', ''),
          callbackURL: 'https://tranquil-transformation-production-5166.up.railway.app/api/connect/facebook/callback',
          scope: ['email', 'public_profile'],
        },
      },
    },
  },

});
