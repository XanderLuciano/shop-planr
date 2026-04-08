/**
 * Pure helpers for converting between tab names and URL hashes
 * on the Part Browser Detail page.
 *
 * Placed in `app/utils/` for Nuxt auto-import.
 */

export function tabToHash(tab: string): string {
  return `#${tab}`
}

export function hashToTab(hash: string): string {
  const tab = hash.replace(/^#/, '')
  return tab === 'siblings' ? 'siblings' : 'routing'
}
