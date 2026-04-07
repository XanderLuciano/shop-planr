import type { $Fetch } from 'ofetch'

/**
 * Returns a per-app `$fetch` instance that automatically injects
 * the Authorization header on `/api/` requests when a JWT token
 * is present. Uses `$fetch.create()` (ofetch-native) — no global
 * mutation, no SSR cross-request leakage.
 *
 * The instance is created once per Nuxt app via `useNuxtApp().$authFetch`,
 * which is provided by `app/plugins/auth.ts`.
 *
 * Usage in composables:
 *   const $api = useAuthFetch()
 *   const data = await $api<Job[]>('/api/jobs')
 */
export function useAuthFetch(): $Fetch {
  return useNuxtApp().$authFetch as $Fetch
}
