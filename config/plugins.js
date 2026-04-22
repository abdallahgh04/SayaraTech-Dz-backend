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
          enabled:      env.bool('GOOGLE_ENABLED', false),
          icon:         'google',
          key:          env('GOOGLE_CLIENT_ID',     ''),
          secret:       env('GOOGLE_CLIENT_SECRET', ''),
          callbackURL:  env('GOOGLE_REDIRECT_URI',  'https://tranquil-transformation-production-5166.up.railway.app/api/connect/google/callback'),
          scope: ['email', 'profile'],
        },
        facebook: {
          enabled:      env.bool('FACEBOOK_ENABLED', false),
          icon:         'facebook',
          key:          env('FACEBOOK_APP_ID',     ''),
          secret:       env('FACEBOOK_APP_SECRET', ''),
          callbackURL:  env('FACEBOOK_REDIRECT_URI', 'http://localhost:1337/api/connect/facebook/callback'),
          scope: ['email', 'public_profile'],
        },
      },
    },
  },

});
