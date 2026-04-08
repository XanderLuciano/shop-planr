/**
 * Shared fast-check arbitraries for navigation stack property tests.
 */
import fc from 'fast-check'

export interface NavigationEntry {
  path: string
  label: string
}

/** Generates valid route paths matching known patterns */
export const arbRoutePath = fc.oneof(
  fc.constant('/'),
  fc.constant('/jobs'),
  fc.tuple(fc.stringMatching(/^[A-Za-z0-9_-]+$/).filter(s => s.length > 0)).map(([id]) => `/jobs/${id}`),
  fc.constant('/parts-browser'),
  fc.tuple(fc.stringMatching(/^[A-Za-z0-9_-]+$/).filter(s => s.length > 0)).map(([id]) => `/parts-browser/${id}`),
  fc.constant('/parts'),
  fc.tuple(fc.stringMatching(/^[A-Za-z0-9_-]+$/).filter(s => s.length > 0)).map(([id]) => `/parts/step/${id}`),
  fc.constant('/queue'),
  fc.constant('/templates'),
  fc.constant('/bom'),
  fc.constant('/certs'),
  fc.constant('/audit'),
  fc.constant('/settings'),
)

/** Generates paths that don't match any known pattern */
export const arbUnknownPath = fc.stringMatching(/^\/[a-z]{2,10}\/[a-z]{2,10}\/[a-z]{2,10}$/)

/** Generates valid NavigationEntry objects */
export const arbNavigationEntry: fc.Arbitrary<NavigationEntry> = arbRoutePath.map(path => ({
  path,
  label: `Label for ${path}`,
}))

/** Generates invalid entries (empty path, missing /, missing fields) */
export const arbInvalidEntry = fc.oneof(
  fc.record({ path: fc.constant(''), label: fc.string() }),
  fc.record({ path: fc.string().filter(s => !s.startsWith('/')), label: fc.string() }),
  fc.record({ path: fc.constant('/valid'), label: fc.constant('') }),
)

/** Generates sequences of 1-30 navigation entries */
export const arbNavigationSequence = fc.array(arbNavigationEntry, { minLength: 1, maxLength: 30 })
