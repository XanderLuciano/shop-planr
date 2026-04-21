/**
 * Auth e2e: kiosk login, PIN setup, switch user.
 *
 * Non-goals: invalid PIN retry limits (covered by service tests), token
 * refresh (covered by unit tests).
 */
import { test, expect } from './fixtures'
import { TEST_USERS, AUTH_COOKIE, UNREGISTERED_USERNAME } from './helpers/auth'

async function enterPin(page: import('@playwright/test').Page, pin: string) {
  for (let i = 0; i < 4; i++) {
    await page.getByLabel(`PIN digit ${i + 1}`).fill(pin[i]!)
  }
}

test.describe('authentication', () => {
  test('new user sets up a PIN and lands signed in', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/')

    // Users are fetched client-side after mount — wait for the avatar grid.
    const tonyAvatar = page.locator(`[data-testid="avatar-picker-user"][data-username="${UNREGISTERED_USERNAME}"]`)
    await expect(tonyAvatar).toBeVisible({ timeout: 15_000 })
    await tonyAvatar.click()

    // PinSetup renders two sequential PinEntry instances (create then confirm).
    await enterPin(page, '1234')
    await enterPin(page, '1234')

    await expect(page.getByTestId('user-menu-trigger')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('user-menu-trigger')).toContainText(UNREGISTERED_USERNAME)

    const cookies = await context.cookies()
    expect(cookies.some(c => c.name === AUTH_COOKIE && c.value)).toBe(true)
  })

  test('existing user logs in with PIN', async ({ page, context, request }) => {
    // Ensure Sarah has a PIN (idempotent — may already be set by a fixture).
    const users = await (await request.get('/api/users')).json()
    const sarah = users.find((u: { username: string, hasPin: boolean }) => u.username === TEST_USERS.admin.username)
    if (sarah && !sarah.hasPin) {
      await request.post('/api/auth/setup-pin', {
        data: { userId: sarah.id, pin: TEST_USERS.admin.pin },
      })
    }

    await context.clearCookies()
    await page.goto('/')

    const sarahAvatar = page.locator(`[data-testid="avatar-picker-user"][data-username="${TEST_USERS.admin.username}"]`)
    await expect(sarahAvatar).toBeVisible()
    await sarahAvatar.click()
    await expect(page.getByText(/enter your pin/i)).toBeVisible()
    await enterPin(page, TEST_USERS.admin.pin)

    await expect(page.getByTestId('user-menu-trigger')).toBeVisible({ timeout: 10_000 })
  })

  test('switch user clears session and returns to picker', async ({ adminPage }) => {
    await adminPage.goto('/')
    const trigger = adminPage.getByTestId('user-menu-trigger')
    await expect(trigger).toBeVisible()
    await adminPage.waitForLoadState('networkidle')

    await trigger.click()
    const menuItem = adminPage.getByRole('menuitem', { name: /switch user/i })
    await expect(menuItem).toBeVisible({ timeout: 5_000 })
    await menuItem.click()

    await expect(adminPage.getByText('Select a user')).toBeVisible()
    await expect(trigger).not.toBeVisible()
  })

  test('log out clears the session', async ({ adminPage, context }) => {
    await adminPage.goto('/')
    const trigger = adminPage.getByTestId('user-menu-trigger')
    await expect(trigger).toBeVisible()
    await adminPage.waitForLoadState('networkidle')

    await trigger.click()
    const menuItem = adminPage.getByRole('menuitem', { name: /log out/i })
    await expect(menuItem).toBeVisible({ timeout: 5_000 })
    await menuItem.click()

    await expect(adminPage.getByText('Select a user')).toBeVisible()
    const cookies = await context.cookies()
    const stillAuthed = cookies.some(c => c.name === AUTH_COOKIE && c.value)
    expect(stillAuthed).toBe(false)
  })
})
