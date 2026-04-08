export function useAdvanceBatch() {
  const $api = useAuthFetch()

  async function advanceBatch(params: {
    partIds: string[]
    jobId: string
    pathId: string
    stepId: string
    availablePartCount: number
    note?: string
  }): Promise<{ advanced: number }> {
    const { partIds, jobId, pathId, stepId, availablePartCount, note } = params

    // Client-side guard: instant feedback before any API calls
    if (partIds.length > availablePartCount) {
      throw new Error(`Cannot advance ${partIds.length} parts — only ${availablePartCount} available`)
    }

    for (const partId of partIds) {
      await $api(`/api/parts/${encodeURIComponent(partId)}/advance`, {
        method: 'POST',
      })
    }

    // Create note if provided and non-empty
    const trimmedNote = note?.trim()
    if (trimmedNote && trimmedNote.length > 0) {
      if (trimmedNote.length > 1000) {
        throw new Error('Note must be 1000 characters or fewer')
      }
      await $api('/api/notes', {
        method: 'POST',
        body: {
          jobId,
          pathId,
          stepId,
          partIds,
          text: trimmedNote,
        },
      })
    }

    return { advanced: partIds.length }
  }

  return { advanceBatch }
}
