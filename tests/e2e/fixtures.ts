/**
 * Shared Playwright fixtures.
 *
 * Provides authenticated page fixtures so each test starts on a fresh context
 * already signed in as the desired user. Tests that specifically exercise the
 * login flow should use the raw `page` fixture and go through the UI.
 */
import { test as base, expect } from '@playwright/test'
import { acquireToken, setAuthCookie, TEST_USERS, type TestUser } from './helpers/auth'

interface Fixtures {
  /** Sign in as SAMPLE-Sarah (admin) before the test body runs. */
  adminPage: import('@playwright/test').Page
  /** Sign in as SAMPLE-Mike (non-admin operator). */
  operatorPage: import('@playwright/test').Page
  /** Factory: sign in as any seeded user. */
  signInAs: (user: TestUser) => Promise<void>
}

export const test = base.extend<Fixtures>({
  signInAs: async ({ context, request, baseURL }, use) => {
    await use(async (user: TestUser) => {
      if (!baseURL) throw new Error('baseURL not set')
      const { username, pin } = TEST_USERS[user]
      const token = await acquireToken(request, username, pin)
      await setAuthCookie(context, token, baseURL)
    })
  },

  adminPage: async ({ context, request, baseURL, page }, use) => {
    if (!baseURL) throw new Error('baseURL not set')
    const token = await acquireToken(request, TEST_USERS.admin.username)
    await setAuthCookie(context, token, baseURL)
    await use(page)
  },

  operatorPage: async ({ context, request, baseURL, page }, use) => {
    if (!baseURL) throw new Error('baseURL not set')
    const token = await acquireToken(request, TEST_USERS.operator.username)
    await setAuthCookie(context, token, baseURL)
    await use(page)
  },
})

export { expect }
