/**
 * Parts lifecycle e2e.
 *
 * Covers the operator-facing flows that move parts through the shop:
 *   1. Create parts on the first step of a path
 *   2. Advance parts from one step to the next via the step view
 *   3. Skip an optional step
 *
 * Preconditions are set up via the API (createJob, createPath) so each test
 * starts with a clean fixture independent of the other tests.
 */
import { test, expect } from './fixtures'
import { apiAs, createJob, createPath, createParts, advanceParts, getPath } from './helpers/api'

test.describe('parts lifecycle', () => {
  test('admin creates parts on the first step via PartCreationPanel', async ({ adminPage, baseURL }) => {
    const api = await apiAs(baseURL!, 'admin')
    const job = await createJob(api, { name: `E2E Create-Parts ${Date.now()}`, goalQuantity: 5 })
    const path = await createPath(api, {
      jobId: job.id,
      name: 'Main',
      goalQuantity: 5,
      steps: [{ name: 'CNC Machine' }, { name: 'Inspection' }],
    })

    await adminPage.goto(`/parts/step/${path.steps[0]!.id}`)
    // useStepView fetches step data on mount; dev-server page loads are slow
    // in CI-like conditions — give the heading 20s and then settle on idle.
    await expect(adminPage.getByRole('heading', { name: 'CNC Machine' })).toBeVisible({ timeout: 20_000 })
    await adminPage.waitForLoadState('networkidle')

    const qtyInput = adminPage.locator('input[type="number"]').first()
    await qtyInput.fill('3')

    await adminPage.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(adminPage.getByText(/3 parts created/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('operator advances parts from one step to the next', async ({ operatorPage, baseURL }) => {
    // Setup: job with 2 parts already sitting on step 2 (Deburr).
    const api = await apiAs(baseURL!, 'admin')
    const job = await createJob(api, { name: `E2E Advance ${Date.now()}`, goalQuantity: 2 })
    const path = await createPath(api, {
      jobId: job.id,
      name: 'Main',
      goalQuantity: 2,
      steps: [{ name: 'CNC Machine' }, { name: 'Deburr' }, { name: 'Inspection' }],
    })
    const parts = await createParts(api, { jobId: job.id, pathId: path.id, quantity: 2 })
    // Advance them past CNC so they land on Deburr (step 1).
    await advanceParts(api, parts.map(p => p.id))

    await operatorPage.goto(`/parts/step/${path.steps[1]!.id}`)
    await expect(operatorPage.getByRole('heading', { name: 'Deburr' })).toBeVisible({ timeout: 10_000 })
    await operatorPage.waitForLoadState('networkidle')

    const advanceBtn = operatorPage.getByRole('button', { name: 'Advance', exact: true })
    await expect(advanceBtn).toBeEnabled()
    await advanceBtn.click()

    // Nuxt UI toast renders the same text in several nodes (title, description,
    // sr-only alert region) — `.first()` sidesteps strict-mode violations.
    await expect(operatorPage.getByText(/2 parts moved to Inspection/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('admin skips an optional step via Advanced options', async ({ adminPage, baseURL }) => {
    // Setup: path where step 2 is optional. Create 1 part, advance it to
    // step 2, then skip ahead to step 3.
    const api = await apiAs(baseURL!, 'admin')
    const job = await createJob(api, { name: `E2E Skip ${Date.now()}`, goalQuantity: 1 })
    const path = await createPath(api, {
      jobId: job.id,
      name: 'Main',
      goalQuantity: 1,
      advancementMode: 'flexible',
      steps: [
        { name: 'CNC Machine' },
        { name: 'Optional Inspection', optional: true },
        { name: 'Final Inspection' },
      ],
    })
    const [part] = await createParts(api, { jobId: job.id, pathId: path.id, quantity: 1 })
    await advanceParts(api, [part!.id])
    // Part is now at step 1 (Optional Inspection).

    const fresh = await getPath(api, path.id)
    const targetStepId = fresh.steps.find(s => s.name === 'Final Inspection')!.id

    await adminPage.goto(`/parts/step/${fresh.steps[1]!.id}`)
    await expect(adminPage.getByRole('heading', { name: 'Optional Inspection' })).toBeVisible({ timeout: 10_000 })
    await adminPage.waitForLoadState('networkidle')

    // Expand Advanced options (admin-only section in ProcessAdvancementPanel).
    await adminPage.getByRole('button', { name: /advanced options/i }).click()

    // Pick the skip-to target from the dropdown. USelect renders a native-ish
    // picker — pass the target option's visible label.
    await adminPage.locator('button[role="combobox"]').first().click()
    await adminPage.getByRole('option', { name: /Final Inspection/ }).click()

    await adminPage.getByRole('button', { name: /skip selected parts/i }).click()

    await expect(adminPage.getByText('Parts skipped', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

    // Verify server-side: the part has moved to the target step (Final Inspection).
    const updated = await (await api.request.get(`/api/parts/${part!.id}`)).json()
    expect(updated.currentStepId).toBe(targetStepId)
  })
})
