export interface FallbackMapping {
  pattern: RegExp
  fallback: string
}

export const FALLBACK_ROUTES: FallbackMapping[] = [
  { pattern: /^\/parts-browser\/[^/]+$/, fallback: '/parts-browser' },
  { pattern: /^\/parts\/step\/[^/]+$/, fallback: '/parts' },
  { pattern: /^\/jobs\/new$/, fallback: '/jobs' },
  { pattern: /^\/jobs\/edit\/[^/]+$/, fallback: '/jobs' },
  { pattern: /^\/jobs\/[^/]+$/, fallback: '/jobs' },
  { pattern: /^\/serials\/[^/]+$/, fallback: '/parts-browser' },
  { pattern: /^\/queue$/, fallback: '/' },
]

/** Compute the fallback route for a given path. Returns "/" if no specific mapping matches. */
export function resolveFallbackRoute(currentPath: string): string {
  for (const entry of FALLBACK_ROUTES) {
    if (entry.pattern.test(currentPath)) return entry.fallback
  }
  return '/'
}
