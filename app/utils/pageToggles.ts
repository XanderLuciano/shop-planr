/**
 * Re-export page toggle utilities for client-side use.
 *
 * `server/utils/` is auto-imported by Nitro (server-only).
 * This file makes the same utilities available to Nuxt's client-side
 * auto-import system (`app/utils/` is auto-imported by Nuxt).
 */
export { DEFAULT_PAGE_TOGGLES, ROUTE_TOGGLE_MAP, isPageEnabled } from '../../server/utils/pageToggles'
