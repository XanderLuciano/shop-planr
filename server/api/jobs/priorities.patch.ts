export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { jobService } = getServices()
  return jobService.updatePriorities(body)
})
