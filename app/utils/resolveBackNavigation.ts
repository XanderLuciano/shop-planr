/**
 * Pure helper that computes the back-arrow destination and label
 * based on the `from` query parameter value.
 *
 * Placed in `app/utils/` for Nuxt auto-import.
 */

export interface BackNavigation {
  to: string
  label: string
}

export function resolveBackNavigation(from: string | undefined | null): BackNavigation {
  if (typeof from === 'string' && from.startsWith('/jobs/')) {
    return { to: from, label: 'Back to Job' }
  }

  if (typeof from === 'string' && from.startsWith('/parts-browser/')) {
    return { to: from, label: 'Back to Part' }
  }

  return { to: '/parts', label: 'Back to Parts' }
}
