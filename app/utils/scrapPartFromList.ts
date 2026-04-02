/**
 * Pure helpers for removing a scrapped part from the part list
 * and the selected-parts set.
 *
 * Placed in `app/utils/` for Nuxt auto-import.
 */

export function removePartFromList(partIds: string[], scrappedId: string): string[] {
  return partIds.filter(id => id !== scrappedId)
}

export function removePartFromSelection(selected: Set<string>, scrappedId: string): Set<string> {
  const next = new Set(selected)
  next.delete(scrappedId)
  return next
}
