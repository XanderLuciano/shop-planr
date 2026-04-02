export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { jobService } = getServices()
  return jobService.updateJob(id, body)
})
