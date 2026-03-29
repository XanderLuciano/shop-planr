/**
 * Page toggle utilities for SHOP_ERP.
 *
 * Auto-imported by Nitro — available in all server code without explicit imports.
 */

import type { PageToggles } from '../types/domain'

/** Default page toggles — all pages enabled. */
export const DEFAULT_PAGE_TOGGLES: PageToggles = {
  jobs: true,
  partsBrowser: true,
  parts: true,
  queue: true,
  templates: true,
  bom: true,
  certs: true,
  jira: true,
  audit: true,
}

/** Maps route base paths to their corresponding toggle key. */
export const ROUTE_TOGGLE_MAP: Record<string, keyof PageToggles> = {
  '/jobs': 'jobs',
  '/parts-browser': 'partsBrowser',
  '/parts': 'parts',
  '/queue': 'queue',
  '/templates': 'templates',
  '/bom': 'bom',
  '/certs': 'certs',
  '/jira': 'jira',
  '/audit': 'audit',
}

/** The set of valid toggle keys. */
export const VALID_TOGGLE_KEYS: ReadonlySet<string> = new Set<string>(
  Object.keys(DEFAULT_PAGE_TOGGLES)
)

/** Sub-route prefixes that bypass their parent's toggle and are always accessible. */
export const ALWAYS_ENABLED_ROUTES: readonly string[] = Object.freeze(['/parts/step'])

/**
 * Merge a partial update into the current page toggles.
 *
 * - Keys not in the update are preserved from `current`.
 * - Unknown keys in `partial` are ignored.
 * - Non-boolean values in `partial` are ignored.
 * - Missing keys in `current` default to `true`.
 */
export function mergePageToggles(
  current: Partial<PageToggles>,
  partial: Record<string, unknown>
): PageToggles {
  const merged: PageToggles = { ...DEFAULT_PAGE_TOGGLES, ...current }

  for (const [key, value] of Object.entries(partial)) {
    if (VALID_TOGGLE_KEYS.has(key) && typeof value === 'boolean') {
      merged[key as keyof PageToggles] = value
    }
  }

  return merged
}

/**
 * Check if a route path is enabled given the current page toggles.
 *
 * - Dashboard (`/`) and Settings (`/settings`) always return `true`.
 * - Detail routes (e.g., `/jobs/123`) inherit their parent page's toggle.
 * - Routes with no toggle mapping return `true`.
 */
export function isPageEnabled(pageToggles: PageToggles, routePath: string): boolean {
  if (routePath === '/' || routePath === '/settings') {
    return true
  }

  for (const prefix of ALWAYS_ENABLED_ROUTES) {
    if (routePath === prefix || routePath.startsWith(prefix + '/')) {
      return true
    }
  }

  for (const [basePath, toggleKey] of Object.entries(ROUTE_TOGGLE_MAP)) {
    if (routePath === basePath || routePath.startsWith(basePath + '/')) {
      return pageToggles[toggleKey] !== false
    }
  }

  return true
}
