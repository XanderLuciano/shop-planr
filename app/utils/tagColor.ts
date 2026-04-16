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

  const hex = m[1] as string
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  // WCAG 2.1 relative luminance
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

  // Threshold ~0.5 balances contrast for both very light and very dark backgrounds.
  return L > 0.5 ? '#000' : '#fff'
}

/**
 * Generate a random tag color with a random hue but fixed saturation (70%)
 * and lightness (55%). This produces vibrant, visually consistent colors
 * that look good as pill backgrounds with white text.
 */
export function randomTagColor(): string {
  const h = Math.floor(Math.random() * 360)
  const s = 70
  const l = 55
  return hslToHex(h, s, l)
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100
  const lN = l / 100
  const a = sN * Math.min(lN, 1 - lN)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = lN - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
