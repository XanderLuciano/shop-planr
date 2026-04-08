export interface NavigationLabel {
  pattern: RegExp
  label: (match: RegExpMatchArray) => string
}

/** Ordered list of route patterns → label resolvers. First match wins. */
export const NAVIGATION_LABELS: NavigationLabel[] = [
  { pattern: /^\/$/, label: () => 'Dashboard' },
  { pattern: /^\/jobs$/, label: () => 'Jobs' },
  { pattern: /^\/jobs\/([^/]+)$/, label: () => 'Job' },
  { pattern: /^\/parts-browser$/, label: () => 'Parts Browser' },
  { pattern: /^\/parts-browser\/([^/]+)$/, label: m => `Part ${decodeURIComponent(m[1]!)}` },
  { pattern: /^\/parts$/, label: () => 'Parts' },
  { pattern: /^\/parts\/step\/([^/]+)$/, label: () => 'Step View' },
  { pattern: /^\/queue$/, label: () => 'Work Queue' },
  { pattern: /^\/templates$/, label: () => 'Templates' },
  { pattern: /^\/bom$/, label: () => 'BOM' },
  { pattern: /^\/certs$/, label: () => 'Certs' },
  { pattern: /^\/audit$/, label: () => 'Audit' },
  { pattern: /^\/settings$/, label: () => 'Settings' },
]

/** Resolve a route path to a human-readable label. Returns "Back" for unknown routes. */
export function resolveLabel(path: string): string {
  for (const entry of NAVIGATION_LABELS) {
    const match = path.match(entry.pattern)
    if (match) return entry.label(match)
  }
  return 'Back'
}

/**
 * Extract the route pattern (path without dynamic segments) for same-page-type detection.
 * e.g., "/parts/step/abc123" → regex source for /parts/step/:id pattern
 */
export function routePattern(path: string): string {
  for (const entry of NAVIGATION_LABELS) {
    if (entry.pattern.test(path)) return entry.pattern.source
  }
  return path
}
