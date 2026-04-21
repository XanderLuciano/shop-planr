import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import type { Plugin } from 'vite'

/**
 * Vite plugin that replaces Nuxt's compile-time `import.meta.client`
 * and `import.meta.server` constants so composables work in vitest.
 */
function nuxtImportMetaPlugin(): Plugin {
  return {
    name: 'nuxt-import-meta',
    transform(code, id) {
      if (id.includes('node_modules')) return
      if (code.includes('import.meta.client') || code.includes('import.meta.server')) {
        return {
          code: code
            .replace(/import\.meta\.client/g, 'true')
            .replace(/import\.meta\.server/g, 'false'),
          map: null,
        }
      }
    },
  }
}

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    pool: 'threads',
    // Exclude Playwright e2e specs — they use a different runner and import
    // `@playwright/test`, which refuses to load under vitest. Run with
    // `npm run test:e2e` instead.
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
    env: {
      TZ: 'UTC',
    },
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },
  },
  plugins: [nuxtImportMetaPlugin()],
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '@': resolve(__dirname, '.'),
    },
  },
})
