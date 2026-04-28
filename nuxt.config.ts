// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/content',
  ],

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],

  content: {},

  runtimeConfig: {
    dbType: process.env.DB_TYPE || 'sqlite',
    dbPath: process.env.DB_PATH || './data/shop_erp.db',
    jiraBaseUrl: process.env.JIRA_BASE_URL || '',
    jiraProjectKey: process.env.JIRA_PROJECT_KEY || 'PI',
    jiraUsername: process.env.JIRA_USERNAME || '',
    jiraApiToken: process.env.JIRA_API_TOKEN || '',
  },

  compatibilityDate: '2025-01-15',

  nitro: {
    experimental: {
      openAPI: true,
    },
    openAPI: {
      meta: {
        title: 'Shop Planr API',
        description: 'REST API for the Shop Planr job routing and ERP system — 60+ endpoints across 14 service domains.',
        version: '1.0.0',
      },
      production: 'prerender',
      ui: {
        scalar: {
          route: '/_scalar',
        },
        swagger: false,
      },
    },
  },

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
      ],
    },
  },

  typescript: {
    tsConfig: {
      compilerOptions: {
        useUnknownInCatchVariables: false,
      },
    },
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'always-multiline',
        braceStyle: '1tbs',
      },
    },
  },
})
