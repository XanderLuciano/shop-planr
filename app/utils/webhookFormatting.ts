/**
 * Shared webhook formatting utilities.
 * Auto-imported by Nuxt on the client side.
 *
 * The canonical implementation lives in server/utils/webhookEmit.ts
 * (formatWebhookEventType). This re-export makes it available as a
 * Nuxt auto-import for components and pages without importing from
 * the server layer.
 */

/**
 * Format a webhook event type for display: "part_advanced" → "Part Advanced"
 *
 * Delegates to the server-side formatWebhookEventType so there is a
 * single source of truth for the formatting logic.
 */
export { formatWebhookEventType as formatEventType } from '../../server/utils/webhookEmit'
