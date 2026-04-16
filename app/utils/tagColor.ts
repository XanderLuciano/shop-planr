/**
 * Heuristic: pick a readable foreground color ("#fff" or "#000") against a
 * given hex background using WCAG-ish relative luminance.
 *
 * Used by tag pills, group borders, and anywhere else we accept a
 * user-supplied color that we then render text over.
 */
export function readableForeground(hexColor: string): '#fff' | '#000' {
  const m = /^#([0-9a-f]{6})$/i.exec(hexColor)
  if (!m) return '#fff'

  const r = parseInt(m[1].slice(0, 2), 16) / 255
  const g = parseInt(m[1].slice(2, 4), 16) / 255
  const b = parseInt(m[1].slice(4, 6), 16) / 255

  // WCAG 2.1 relative luminance
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

  // Threshold ~0.5 balances contrast for both very light and very dark backgrounds.
  return L > 0.5 ? '#000' : '#fff'
}
