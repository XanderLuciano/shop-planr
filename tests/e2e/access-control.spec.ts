/**
 * Access-control e2e: admin gates for create/delete.
 *
 * Non-admin users should never see destructive or creative controls. The UI
 * hides them via `useAuth().isAdmin`; the server also enforces via 403 —
 * these tests cover the client side so regressions surface early.
 */
import { test, expect } from './fixtures'
import { apiAs, seedJobWithParts } from './helpers/api'

test.describe('access control', () => {
  test('non-admin does not see the "New Job" button on /jobs', async ({ operatorPage }) => {
    await operatorPage.goto('/jobs')
    await expect(operatorPage.getByRole('heading', { name: 'Jobs' })).toBeVisible()
    await operatorPage.waitForLoadState('networkidle')

    await expect(operatorPage.getByRole('button', { name: 'New Job' })).toHaveCount(0)
  })

  test('non-admin visiting /jobs/new is redirected away', async ({ operatorPage }) => {
    await operatorPage.goto('/jobs/new')
    // Guard runs in onMounted and navigates to /jobs.
    await expect(operatorPage).toHaveURL(/\/jobs$/, { timeout: 10_000 })
  })

  test('non-admin does not see the "Delete Part" button on part detail', async ({ operatorPage, baseURL }) => {
    const api = await apiAs(baseURL!, 'admin')
    try {
      const { parts } = await seedJobWithParts(api, {
        jobName: `E2E Guard-Part ${Date.now()}`,
        partQuantity: 1,
      })
      const partId = parts[0]!.id

      await operatorPage.goto(`/parts-browser/${partId}`)
      await expect(operatorPage.getByRole('heading', { name: partId })).toBeVisible({ timeout: 10_000 })
      await operatorPage.waitForLoadState('networkidle')

      await expect(operatorPage.getByRole('button', { name: 'Delete Part', exact: true })).toHaveCount(0)
    } finally {
      await api.dispose()
    }
  })
})
