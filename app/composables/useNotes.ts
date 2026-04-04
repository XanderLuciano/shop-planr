import { ref, readonly } from 'vue'
import type { StepNote } from '~/types/domain'

const notes = ref<StepNote[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useNotes() {
  async function createNote(input: {
    jobId: string
    pathId: string
    stepId: string
    partIds: string[]
    text: string
    userId: string
  }): Promise<StepNote> {
    loading.value = true
    error.value = null
    try {
      const note = await $fetch<StepNote>('/api/notes', {
        method: 'POST',
        body: input,
      })
      notes.value = [note, ...notes.value]
      return note
    } catch (e) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to create note'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchNotesForPart(partId: string): Promise<StepNote[]> {
    loading.value = true
    error.value = null
    try {
      const result = await $fetch<StepNote[]>(`/api/notes/part/${partId}`)
      notes.value = result
      return result
    } catch (e) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch notes'
      return []
    } finally {
      loading.value = false
    }
  }

  async function fetchNotesForStep(stepId: string): Promise<StepNote[]> {
    loading.value = true
    error.value = null
    try {
      const result = await $fetch<StepNote[]>(`/api/notes/step/${stepId}`)
      notes.value = result
      return result
    } catch (e) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch notes'
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    notes: readonly(notes),
    loading: readonly(loading),
    error: readonly(error),
    createNote,
    fetchNotesForPart,
    fetchNotesForStep,
  }
}
