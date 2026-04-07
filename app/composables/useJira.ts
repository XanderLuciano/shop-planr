import { ref, readonly } from 'vue'
import type { JiraTicket, FetchTicketsResult, JiraPushResult } from '~/types/jira'
import type { LinkJiraInput } from '~/types/api'
import type { Job, Path } from '~/types/domain'

const tickets = ref<readonly JiraTicket[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const fromCache = ref(false)

export function useJira() {
  const $api = useAuthFetch()

  async function fetchTickets() {
    loading.value = true
    error.value = null
    fromCache.value = false
    try {
      const result = await $api<FetchTicketsResult>('/api/jira/tickets')
      tickets.value = result.tickets
      error.value = result.error
      fromCache.value = result.fromCache
    } catch (e) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch Jira tickets'
      tickets.value = []
    } finally {
      loading.value = false
    }
  }

  async function linkTicket(input: LinkJiraInput): Promise<{ job: Job, path: Path | null }> {
    const result = await $api<{ job: Job, path: Path | null }>('/api/jira/link', {
      method: 'POST',
      body: input,
    })
    // Re-fetch tickets so the linked one disappears from the list
    await fetchTickets()
    return result
  }

  async function refreshTickets() {
    await fetchTickets()
  }

  async function pushDescriptionTable(jobId: string): Promise<JiraPushResult> {
    return await $api<JiraPushResult>('/api/jira/push', {
      method: 'POST',
      body: { jobId },
    })
  }

  async function pushCommentSummary(jobId: string): Promise<JiraPushResult> {
    return await $api<JiraPushResult>('/api/jira/comment', {
      method: 'POST',
      body: { jobId },
    })
  }

  async function pushNoteAsComment(jobId: string, noteId: string): Promise<JiraPushResult> {
    return await $api<JiraPushResult>('/api/jira/comment', {
      method: 'POST',
      body: { jobId, noteId },
    })
  }

  return {
    tickets: readonly(tickets),
    loading: readonly(loading),
    error: readonly(error),
    fromCache: readonly(fromCache),
    fetchTickets,
    linkTicket,
    refreshTickets,
    pushDescriptionTable,
    pushCommentSummary,
    pushNoteAsComment,
  }
}
