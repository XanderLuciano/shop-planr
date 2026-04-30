import { testN8nConnectionSchema } from '../../schemas/settingsSchemas'
import { requireAdmin } from '../../utils/auth'
import { extractN8nError } from '../../utils/n8nErrors'

/**
 * POST /api/n8n/test-connection
 *
 * Probes an n8n instance with the given baseUrl + apiKey WITHOUT persisting
 * them. Lets admins validate credentials from the Settings → n8n form before
 * clicking Save. If either field is omitted, falls back to the saved/env
 * connection so clicking "Test" on a populated form tests what they see.
 *
 * Admin-gated: probing an arbitrary URL with an API key is a sensitive
 * operation and the endpoint shouldn't be available to non-admins.
 */
defineRouteMeta({
  openAPI: {
    tags: ['n8n'],
    description: 'Test an n8n connection with ad-hoc credentials without persisting them. Admin only.',
    requestBody: zodRequestBody(testN8nConnectionSchema),
    responses: {
      200: { description: 'Test result (success or failure — both 200)' },
      400: { description: 'Validation error' },
      403: { description: 'Admin access required' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, testN8nConnectionSchema)
  const userId = getAuthUserId(event)

  const { settingsService } = getServices()
  const repos = getRepositories()
  requireAdmin(repos.users, userId, 'test n8n connections')

  // If the caller didn't supply baseUrl/apiKey, probe with the currently
  // saved (or env-bootstrapped) connection. This lets the Test button work
  // on an unchanged form without forcing the UI to resend stored values.
  const stored = settingsService.getN8nConnection()
  const baseUrl = (body.baseUrl ?? stored.baseUrl).trim()
  const apiKey = (body.apiKey ?? stored.apiKey).trim()

  if (!baseUrl || !apiKey) {
    return {
      connected: false,
      baseUrl,
      error: 'Provide both a base URL and an API key to test the connection.',
    }
  }

  try {
    await $fetch(`${baseUrl.replace(/\/+$/, '')}/api/v1/workflows`, {
      method: 'GET',
      headers: { 'X-N8N-API-KEY': apiKey },
      query: { limit: 1 },
    })
    return { connected: true, baseUrl }
  } catch (e: unknown) {
    return { connected: false, baseUrl, error: extractN8nError(e) }
  }
})
