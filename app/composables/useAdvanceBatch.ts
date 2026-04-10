export function useAdvanceBatch() {
  const $api = useAuthFetch()

  interface BatchAdvanceResponse {
    advanced: number
    failed: number
    results: { partId: string, success: boolean, error?: string }[]
  }

  async function advanceBatch(params: {
    partIds: string[]
    jobId: string
    pathId: string
    stepId: string
    availablePartCount: number
    note?: string
  }): Promise<{ advanced: number, failed: number }> {
    const { partIds, jobId, pathId, stepId, availablePartCount, note } = params

    // Client-side guard: instant feedback before any API calls
    if (partIds.length > availablePartCount) {
      throw new Error(`Cannot advance ${partIds.length} parts — only ${availablePartCount} available`)
    }

    // Single HTTP call replaces N sequential calls
    const response = await $api<BatchAdvanceResponse>('/api/parts/advance', {
      method: 'POST',
      body: { partIds },
    })

    // Create note only for successfully-advanced parts
    const trimmedNote = note?.trim()
    const succeededPartIds = response.results
      .filter(r => r.success)
      .map(r => r.partId)

    if (trimmedNote && trimmedNote.length > 0 && succeededPartIds.length > 0) {
      if (trimmedNote.length > 1000) {
        throw new Error('Note must be 1000 characters or fewer')
      }
      await $api('/api/notes', {
        method: 'POST',
        body: {
          jobId,
          pathId,
          stepId,
          partIds: succeededPartIds,
          text: trimmedNote,
        },
      })
    }

    return { advanced: response.advanced, failed: response.failed }
  }

  return { advanceBatch }
}
