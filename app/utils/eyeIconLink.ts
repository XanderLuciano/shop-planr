/**
 * Pure helper that builds the navigation link for the eye icon
 * on the ProcessAdvancementPanel part list.
 *
 * Placed in `app/utils/` for Nuxt auto-import.
 */

export function partDetailLink(partId: string, from?: string): string {
  const base = `/parts-browser/${encodeURIComponent(partId)}`
  if (from) return `${base}?from=${encodeURIComponent(from)}`
  return base
}
