/**
 * Playwright global setup.
 *
 * Resets the e2e test database to a known state before the suite runs:
 *   1. Delete ./data/test.db (and its WAL/SHM sidecars)
 *   2. Invoke the seed script which runs migrations + inserts SAMPLE- data
 *
 * Runs once per `npx playwright test` invocation (before the webServer starts,
 * so Nuxt dev opens the freshly-seeded DB).
 */
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

const TEST_DB = resolve(process.cwd(), 'data', 'test.db')

function unlinkIfExists(path: string): void {
  if (existsSync(path)) unlinkSync(path)
}

export default async function globalSetup(): Promise<void> {
  console.log('[e2e] Resetting test DB at', TEST_DB)

  unlinkIfExists(TEST_DB)
  unlinkIfExists(`${TEST_DB}-wal`)
  unlinkIfExists(`${TEST_DB}-shm`)

  execSync(`npx tsx server/scripts/seed.ts ${TEST_DB}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
}
