/**
 * Job & path creation e2e.
 *
 * Covers the admin-only mutations that drive all downstream workflows:
 *   1. Create a job with one path + steps from /jobs/new
 *   2. Add a second path to an existing job from the job detail page
 *
 * Editing paths and reordering steps are covered by integration tests.
 */
import { test, expect } from './fixtures'
import { apiAs, createJob } from './helpers/api'

test.describe('jobs', () => {
  test('admin creates a job with a path from /jobs/new', async ({ adminPage }) => {
    const jobName = `E2E Job ${Date.now()}`

    await adminPage.goto('/jobs/new')
    await expect(adminPage.getByRole('heading', { name: 'New Job' })).toBeVisible()
    await adminPage.waitForLoadState('networkidle')

    await adminPage.getByTestId('job-name-input').fill(jobName)
    await adminPage.getByTestId('job-goal-qty-input').fill('7')

    await adminPage.getByRole('button', { name: 'Add Path' }).click()
    // Wait for the new path row to render — the form uses `v-for` over
    // pathDrafts so the input appears only after the click takes effect.
    await expect(adminPage.getByTestId('path-name-input-0')).toBeVisible()
    await adminPage.getByTestId('path-name-input-0').fill('Main Route')

    // ProcessLocationDropdown binds the typed text via v-model, so we can
    // just type a process name and dismiss the suggestion overlay.
    const processInput = adminPage.getByTestId('process-location-input-process').first()
    await processInput.fill('CNC Machine')
    await adminPage.keyboard.press('Escape')

    await adminPage.getByTestId('job-submit-btn').click()

    await expect(adminPage).toHaveURL(/\/jobs\/job_/, { timeout: 10_000 })
    await expect(adminPage.getByRole('heading', { name: jobName })).toBeVisible()
  })

  test('admin adds a second path to an existing job', async ({ adminPage, baseURL }) => {
    // Use the API for setup — we're testing the add-path flow, not creation.
    const api = await apiAs(baseURL!, 'admin')
    const job = await createJob(api, { name: `E2E Multipath ${Date.now()}`, goalQuantity: 10 })

    await adminPage.goto(`/jobs/${job.id}`)
    await expect(adminPage.getByRole('heading', { name: job.name })).toBeVisible()

    // Open the "New Path" editor.
    await adminPage.getByRole('button', { name: 'Add Path' }).click()

    // Fill the new-path form. The UInput with placeholder "e.g. Standard Route"
    // is the path name; we rely on placeholder text since this editor is
    // lightweight and lives on the job detail page (not in JobCreationForm).
    await adminPage.getByPlaceholder('e.g. Standard Route').fill('Expedited')

    const processInput = adminPage.getByTestId('process-location-input-process').first()
    await processInput.fill('Inspection')
    await adminPage.keyboard.press('Escape')

    await adminPage.getByRole('button', { name: 'Create Path', exact: true }).click()

    // The new path now appears in the paths list on the job page.
    await expect(adminPage.getByText('Expedited')).toBeVisible({ timeout: 10_000 })
  })
})
