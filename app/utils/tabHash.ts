/**
 * Pure helpers for converting between tab names and URL hashes
 * on the Part Browser Detail page.
 *
 * Placed in `app/utils/` for Nuxt auto-import.
 */

export function tabToHash(tab: string): string {
  return tab === 'siblings' ? '#parts' : '#routing'
}

export function hashToTab(hash: string): string {
  return hash === '#parts' ? 'siblings' : 'routing'
}
