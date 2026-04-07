/**
 * Pure helper functions for avatar rendering.
 * Generates deterministic colors and initials from user data.
 */

/**
 * Generates a deterministic HSL color string from a username.
 * Same input always produces the same color.
 */
export function getAvatarColor(username: string): string {
  let hash = 0
  for (const char of username) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 55%)`
}

/**
 * Extracts up to 2 uppercase initials from a display name.
 * e.g. "John Doe" → "JD", "Alice" → "A"
 */
export function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
