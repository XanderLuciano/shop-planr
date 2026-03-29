# Implementation Tasks: Page Toggle Refresh Fix

## Task 1: Create the settings plugin
- [x] Create `app/plugins/settings.ts` with the following content:
  ```typescript
  export default defineNuxtPlugin(async () => {
    const { fetchSettings } = useSettings()
    await fetchSettings()
  })
  ```
- [x] Verify the file is picked up by Nuxt (exists in `app/plugins/` directory)

## Task 2: Remove redundant fetchSettings() from jira.vue
- [x] In `app/pages/jira.vue`, update the `onMounted` hook to remove the `await fetchSettings()` call
- [x] The `onMounted` should change from:
  ```typescript
  onMounted(async () => {
    await fetchSettings()
    if (jiraEnabled.value) {
      await Promise.all([fetchTickets(), fetchTemplates(), fetchJobs()])
    }
  })
  ```
  To:
  ```typescript
  onMounted(async () => {
    if (jiraEnabled.value) {
      await Promise.all([fetchTickets(), fetchTemplates(), fetchJobs()])
    }
  })
  ```
- [x] Remove `fetchSettings` from the `useSettings()` destructure since it's no longer used in this file (keep `settings` since `jiraEnabled` computed reads it)
- [x] Verify no TypeScript errors in the file

## Task 3: Remove redundant fetchSettings() from jobs/[id].vue
- [x] In `app/pages/jobs/[id].vue`, remove the `fetchSettings()` call from the `onMounted` hook (line 275, fire-and-forget call)
- [x] Remove `fetchSettings` from the `useSettings()` destructure if it's no longer used elsewhere in the file (keep `settings` if still read)
- [ ] Verify no TypeScript errors in the file

## Task 4: Remove redundant fetchSettings() from settings.vue
- [x] In `app/pages/settings.vue`, update the `onMounted` hook to remove `fetchSettings()` from the `Promise.all`
- [ ] The `onMounted` should change from:
  ```typescript
  onMounted(async () => {
    await Promise.all([fetchSettings(), loadAllUsers()])
  })
  ```
  To:
  ```typescript
  onMounted(async () => {
    await loadAllUsers()
  })
  ```
- [x] Keep `fetchSettings` in the `useSettings()` destructure — it's still used in the `onSaveToggles` error handler (line 128) to revert on failure
- [ ] Verify no TypeScript errors in the file

## Task 5: Run tests and verify no regressions
- [x] Run `npm run test` and confirm all existing tests pass
- [ ] No new tests needed — this is a plugin + cleanup change; the existing pageToggles property tests and integration tests cover the toggle logic
