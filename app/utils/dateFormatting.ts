/**
 * Shared date formatting helpers.
 *
 * These use the user's local timezone so dates display naturally.
 * Test determinism is handled by pinning TZ=UTC in vitest.config.ts.
 */

/**
 * Formats an ISO timestamp as a short date: "Jan 15, 2025".
 * Always includes the year.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Formats an ISO timestamp as a full date+time string:
 * "Jun 15, 2025, 12:00 PM".
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Formats an ISO timestamp as a short date without year when same year:
 * "Jan 15" (same year) or "Nov 1, 2023" (different year).
 */
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
