/**
 * Fetches the user list once on app startup so components don't need
 * to call fetchUsers() manually. Same pattern as settings.ts.
 *
 * Individual components can still call fetchUsers() to refresh
 * (e.g. AuthOverlay refreshes on user switch).
 *
 * Awaits on SSR so the user list is included in the hydration payload.
 * On the client, skips if SSR already populated the list.
 */
export default defineNuxtPlugin(async () => {
  const { users, fetchUsers } = useAuth()
  if (!users.value.length) {
    await fetchUsers()
  }
})
