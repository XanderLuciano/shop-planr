/**
 * Deletion e2e: admin-only destructive operations.
 *
 * Covers the path and part delete flows, including the cascade-confirmation
 * modal that appears when a path has parts.
 */
import { test, expect } from './fixtures'
import { apiAs, seedJobWithParts, createJob, createPath } from './helpers/api'

test.describe('deletion', () => {
  test('admin deletes an empty path via inline confirmation', async ({ adminPage, baseURL }) => {
    const api = await apiAs(baseURL!, 'admin')
    const job = await createJob(api, { name: `E2E Delete-Path ${Date.now()}`, goalQuantity: 5 })
    const path = await createPath(api, {
      jobId: job.id,
      name: 'Scratch',
      goalQuantity: 5,
      steps: [{ name: 'CNC Machine' }],
    })

    await adminPage.goto(`/jobs/${job.id}`)
    await expect(adminPage.getByText(path.name)).toBeVisible({ timeout: 10_000 })
    await adminPage.waitForLoadState('networkidle')

    // For a path with zero parts PathDeleteButton goes through a two-click
    // inline confirmation (no modal). The trash icon is a button with
    // title "Delete path".
    await adminPage.getByRole('button', { name: 'Delete path' }).first().click()
    await adminPage.getByRole('button', { name: 'Yes', exact: true }).click()

    await expect(adminPage.getByText(path.name)).not.toBeVisible({ timeout: 10_000 })
  })

  test('admin deletes a path with parts via cascade modal', async ({ adminPage, baseURL }) => {
    const api = await apiAs(baseURL!, 'admin')
    const { job, path } = await seedJobWithParts(api, {
      jobName: `E2E Delete-Cascade ${Date.now()}`,
      pathName: 'Cascade',
      partQuantity: 2,
    })

    await adminPage.goto(`/jobs/${job.id}`)
    // 'Cascade' may appear both in the path name and in step/location fields —
    // first match is the path header, which is what we care about.
    await expect(adminPage.getByText(path.name).first()).toBeVisible({ timeout: 10_000 })
    await adminPage.waitForLoadState('networkidle')

    await adminPage.getByRole('button', { name: 'Delete path' }).first().click()

    // With parts present, the button opens a confirmation modal.
    const deleteBtn = adminPage.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true })
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 })
    await deleteBtn.click()

    // Path list re-renders — the former path name is gone from the page.
    await expect(adminPage.getByText(path.name)).toHaveCount(0, { timeout: 10_000 })
  })

  test('admin deletes a part from the part detail page', async ({ adminPage, baseURL }) => {
    const api = await apiAs(baseURL!, 'admin')
    const { parts } = await seedJobWithParts(api, {
      jobName: `E2E Delete-Part ${Date.now()}`,
      partQuantity: 1,
    })
    const partId = parts[0]!.id

    await adminPage.goto(`/parts-browser/${partId}`)
    await expect(adminPage.getByRole('heading', { name: partId })).toBeVisible({ timeout: 10_000 })
    await adminPage.waitForLoadState('networkidle')

    // Open the delete modal — Delete Part button is admin-only.
    await adminPage.getByRole('button', { name: 'Delete Part', exact: true }).click()

    const confirmBtn = adminPage.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true })
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    // After delete, we're sent back to the browser.
    await expect(adminPage).toHaveURL(/\/parts-browser$/, { timeout: 10_000 })

    // Verify server-side: the part is gone.
    const res = await api.request.get(`/api/parts/${partId}`)
    expect(res.status()).toBe(404)
  })
})
