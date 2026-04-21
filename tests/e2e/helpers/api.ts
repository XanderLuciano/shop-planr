/**
 * HTTP API helpers for e2e tests.
 *
 * We call the API directly (rather than driving the UI) to set up test
 * preconditions — creating a job, path, or parts for a test that's really
 * about *advancing* a part, for example. This keeps each test focused on one
 * behavior and makes the suite fast.
 *
 * Usage:
 *   const api = await apiAs(baseURL, 'admin')
 *   try {
 *     const { job, path, parts } = await seedJobWithParts(api, { ... })
 *   } finally {
 *     await api.dispose()
 *   }
 */
import { request as pwRequest, type APIRequestContext } from '@playwright/test'
import { acquireToken, TEST_USERS, type TestUser } from './auth'

export interface ApiClient {
  request: APIRequestContext
  token: string
  /** Dispose the underlying APIRequestContext to avoid handle leaks. */
  dispose: () => Promise<void>
}

/**
 * Create an APIRequestContext with the JWT for the given seeded user baked in.
 * Use this from tests when you need a request client outside the usual
 * `request` fixture (e.g. in `beforeEach` where you want admin rights).
 */
export async function apiAs(baseURL: string, user: TestUser = 'admin'): Promise<ApiClient> {
  const bootstrap = await pwRequest.newContext({ baseURL })
  const token = await acquireToken(bootstrap, TEST_USERS[user].username, TEST_USERS[user].pin)
  await bootstrap.dispose()

  const request = await pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  return { request, token, dispose: () => request.dispose() }
}

// ── Domain helpers ──

export interface StepInput {
  name: string
  location?: string
  assignedTo?: string | null
  optional?: boolean
  dependencyType?: 'physical' | 'preferred' | 'completion_gate'
}

export async function createJob(
  api: ApiClient,
  input: { name: string, goalQuantity: number },
): Promise<{ id: string, name: string }> {
  const res = await api.request.post('/api/jobs', { data: input })
  if (!res.ok()) throw new Error(`createJob failed: ${res.status()} ${await res.text()}`)
  return res.json()
}

export async function createPath(
  api: ApiClient,
  input: {
    jobId: string
    name: string
    goalQuantity: number
    steps: StepInput[]
    advancementMode?: 'strict' | 'flexible' | 'per_step'
  },
): Promise<{ id: string, name: string, steps: Array<{ id: string, name: string }> }> {
  const res = await api.request.post('/api/paths', { data: input })
  if (!res.ok()) throw new Error(`createPath failed: ${res.status()} ${await res.text()}`)
  return res.json()
}

export async function createParts(
  api: ApiClient,
  input: { jobId: string, pathId: string, quantity: number, certId?: string },
): Promise<Array<{ id: string }>> {
  const res = await api.request.post('/api/parts', { data: input })
  if (!res.ok()) throw new Error(`createParts failed: ${res.status()} ${await res.text()}`)
  return res.json()
}

export async function advanceParts(api: ApiClient, partIds: string[]): Promise<void> {
  const res = await api.request.post('/api/parts/advance', { data: { partIds } })
  if (!res.ok()) throw new Error(`advanceParts failed: ${res.status()} ${await res.text()}`)
}

export async function getPath(
  api: ApiClient,
  pathId: string,
): Promise<{ id: string, name: string, steps: Array<{ id: string, name: string, optional?: boolean }> }> {
  const res = await api.request.get(`/api/paths/${encodeURIComponent(pathId)}`)
  if (!res.ok()) throw new Error(`getPath failed: ${res.status()}`)
  return res.json()
}

export async function getPart(api: ApiClient, partId: string): Promise<{ id: string, currentStepIdx: number, status: string }> {
  const res = await api.request.get(`/api/parts/${encodeURIComponent(partId)}`)
  if (!res.ok()) throw new Error(`getPart failed: ${res.status()}`)
  return res.json()
}

/**
 * Create a job + path + N parts in one call. Returned IDs are suitable for
 * navigating to detail pages.
 */
export async function seedJobWithParts(
  api: ApiClient,
  opts: {
    jobName: string
    pathName?: string
    partQuantity: number
    steps?: StepInput[]
  },
) {
  const job = await createJob(api, { name: opts.jobName, goalQuantity: opts.partQuantity })
  const path = await createPath(api, {
    jobId: job.id,
    name: opts.pathName ?? 'Main',
    goalQuantity: opts.partQuantity,
    steps: opts.steps ?? [
      { name: 'CNC Machine' },
      { name: 'Deburr' },
      { name: 'Inspection' },
    ],
  })
  const parts = await createParts(api, { jobId: job.id, pathId: path.id, quantity: opts.partQuantity })
  return { job, path, parts }
}
