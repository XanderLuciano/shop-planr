/**
 * Pure helper functions for PartDeleteButton.
 *
 * Extracted so the component and tests share the same logic.
 */

/** Determines whether the delete button should be visible (admin-only). */
export function isDeleteVisible(isAdmin: boolean): boolean {
  return isAdmin
}

/** Extracts a user-friendly error message from an API error response. */
export function extractDeleteError(e: unknown): string {
  const err = e as {
    response?: { status?: number }
    statusCode?: number
    data?: { message?: string }
    message?: string
  } | null | undefined
  const status = err?.response?.status ?? err?.statusCode
  if (status === 403) return 'Admin access required'
  return err?.data?.message ?? err?.message ?? 'Failed to delete part'
}

/** Builds the confirmation message for the delete modal. */
export function buildConfirmationMessage(partId: string): string {
  return `This will permanently delete part ${partId} and all associated data (certificates, step statuses, overrides). This action cannot be undone.`
}

/** Builds the success toast after deletion. */
export function buildDeleteSuccessToast(partId: string): { title: string, description: string, color: string } {
  return {
    title: 'Part deleted',
    description: `${partId} has been permanently removed`,
    color: 'success',
  }
}
