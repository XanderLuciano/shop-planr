/**
 * Shared webhook formatting utilities.
 * Auto-imported by Nuxt on the client side.
 *
 * This is a standalone copy of the formatting logic (no server imports).
 * The server-side equivalent lives in server/utils/webhookEmit.ts.
 * Both implementations are trivial one-liners — keeping them in sync
 * is simpler than crossing the app/server layer boundary.
 */

/**
 * Format a webhook event type for display: "part_advanced" → "Part Advanced"
 */
export function formatEventType(type: string): string {
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
