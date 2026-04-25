import { defineConfig, configDefaults } from 'vitest/config'
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
    pool: 'forks',
    // Exclude Playwright e2e specs — they use a different runner and import
    // `@playwright/test`, which refuses to load under vitest. Run with
    // `npm run test:e2e` instead.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    env: {
      TZ: 'UTC',
      BCRYPT_ROUNDS: '4',
    },
    poolOptions: {
      forks: {
        // maxForks: 6,
        minForks: 1,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['server/**/*.ts', 'app/**/*.ts', 'app/**/*.vue'],
      exclude: [
        'server/repositories/sqlite/migrations/**',
        '**/*.d.ts',
        '**/*.test.ts',
      ],
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
