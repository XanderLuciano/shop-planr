/**
 * Shared webhook formatting utilities.
 * Auto-imported by Nuxt on the client side.
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
