export default defineNuxtPlugin(async () => {
  const { fetchSettings } = useSettings()
  await fetchSettings()
})
