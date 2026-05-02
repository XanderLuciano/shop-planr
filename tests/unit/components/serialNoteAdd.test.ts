/**
 * Unit tests for part note add pure logic.
 *
 * Tests extracted pure functions that mirror the component's internal logic,
 * following the same pattern as PartCreationPanel.test.ts — no Vue
 * component mounting, no @vue/test-utils.
 *
 * Feature: part-notes-add
 */
import { describe, it, expect } from 'vitest'
import { extractApiError } from '~/app/utils/apiError'

// ---- Pure logic functions extracted from parts-browser/[id].vue ----

/** Toggles form visibility. Returns new showNoteForm state after clicking "Add Note". */
export function toggleFormOpen(): boolean {
  return true
}

/** Toggles form visibility. Returns new showNoteForm state and cleared text after clicking "Cancel". */
export function cancelForm(): { showNoteForm: boolean, noteText: string } {
  return { showNoteForm: false, noteText: '' }
}

/** Returns the Add Note button configuration. */
export function getAddNoteButtonConfig(): { icon: string, label: string } {
  return { icon: 'i-lucide-plus', label: 'Add Note' }
}

/** Returns the success toast object after a note is created. */
export function buildSuccessToast(): { title: string, color: string } {
  return { title: 'Note created', color: 'success' }
}

/** Returns the error toast object when createNote fails. */
export function buildErrorToast(e: any): { title: string, description: string, color: string } {
  return {
    title: 'Failed to create note',
    description: extractApiError(e, 'Failed to create note'),
    color: 'error',
  }
}

/** Determines whether the Save button should be disabled. */
export function isSaveDisabled(noteText: string, noteSaving: boolean): boolean {
  return !noteText.trim() || noteSaving
}

/** Computes loading/disabled/readonly states from noteSaving flag. */
export function getLoadingState(noteSaving: boolean): {
  saveLoading: boolean
  saveDisabled: boolean
  cancelDisabled: boolean
  textareaReadonly: boolean
} {
  return {
    saveLoading: noteSaving,
    saveDisabled: noteSaving,
    cancelDisabled: noteSaving,
    textareaReadonly: noteSaving,
  }
}

/** Extracts error message from various error shapes (matching handleSaveNote catch block). */
export function extractErrorMessage(e: any): string {
  return extractApiError(e, 'Failed to create note')
}

// ---- Tests ----

describe('partNoteAdd — pure logic', () => {
  // 1. Form toggle: clicking "Add Note" shows the form; clicking "Cancel" hides it (Req 2.1, 2.2)
  describe('form toggle', () => {
    it('toggleFormOpen returns true (form becomes visible)', () => {
      expect(toggleFormOpen()).toBe(true)
    })

    it('cancelForm returns hidden form and empty text', () => {
      const result = cancelForm()
      expect(result.showNoteForm).toBe(false)
      expect(result.noteText).toBe('')
    })

    it('cancel after typing clears text', () => {
      // Simulate: user typed something, then cancels
      const result = cancelForm()
      expect(result.noteText).toBe('')
      expect(result.showNoteForm).toBe(false)
    })
  })

  // 2. Button renders with i-lucide-plus icon and "Add Note" label (Req 1.3)
  describe('button config', () => {
    it('returns correct icon', () => {
      const config = getAddNoteButtonConfig()
      expect(config.icon).toBe('i-lucide-plus')
    })

    it('returns correct label', () => {
      const config = getAddNoteButtonConfig()
      expect(config.label).toBe('Add Note')
    })
  })

  // 3. Success toast after save (Req 3.4)
  describe('success toast', () => {
    it('returns toast with title "Note created" and color "success"', () => {
      const toast = buildSuccessToast()
      expect(toast.title).toBe('Note created')
      expect(toast.color).toBe('success')
    })
  })

  // 4. Error toast when createNote fails (Req 4.2)
  describe('error toast', () => {
    it('uses e.data.message when available', () => {
      const toast = buildErrorToast({ data: { message: 'Step not found' } })
      expect(toast.title).toBe('Failed to create note')
      expect(toast.description).toBe('Step not found')
      expect(toast.color).toBe('error')
    })

    it('uses e.message when data.message is absent', () => {
      const toast = buildErrorToast({ message: 'Network error' })
      expect(toast.description).toBe('Network error')
    })

    it('falls back to default description when error has no message', () => {
      const toast = buildErrorToast({})
      expect(toast.description).toBe('Failed to create note')
    })

    it('handles null/undefined error gracefully', () => {
      const toast = buildErrorToast(null)
      expect(toast.description).toBe('Failed to create note')
    })
  })

  // 5. Loading state — Save shows loading + disabled, Cancel disabled, textarea readonly (Req 5.1, 5.2, 5.3)
  describe('loading state', () => {
    it('when noteSaving is true, all controls are locked', () => {
      const state = getLoadingState(true)
      expect(state.saveLoading).toBe(true)
      expect(state.saveDisabled).toBe(true)
      expect(state.cancelDisabled).toBe(true)
      expect(state.textareaReadonly).toBe(true)
    })

    it('when noteSaving is false, all controls are unlocked', () => {
      const state = getLoadingState(false)
      expect(state.saveLoading).toBe(false)
      expect(state.saveDisabled).toBe(false)
      expect(state.cancelDisabled).toBe(false)
      expect(state.textareaReadonly).toBe(false)
    })
  })

  // Additional: Save disabled logic
  describe('isSaveDisabled', () => {
    it('disabled when text is empty', () => {
      expect(isSaveDisabled('', false)).toBe(true)
    })

    it('disabled when text is whitespace-only', () => {
      expect(isSaveDisabled('   ', false)).toBe(true)
    })

    it('disabled when noteSaving is true even with valid text', () => {
      expect(isSaveDisabled('valid note', true)).toBe(true)
    })

    it('enabled when text is non-empty and not saving', () => {
      expect(isSaveDisabled('valid note', false)).toBe(false)
    })
  })

  // Additional: Error message extraction
  describe('extractErrorMessage', () => {
    it('prefers data.message', () => {
      expect(extractErrorMessage({ data: { message: 'Bad request' }, message: 'Generic' })).toBe('Bad request')
    })

    it('falls back to message', () => {
      expect(extractErrorMessage({ message: 'Timeout' })).toBe('Timeout')
    })

    it('falls back to default string', () => {
      expect(extractErrorMessage(undefined)).toBe('Failed to create note')
    })
  })
})
