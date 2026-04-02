export default defineApiHandler((event) => {
  const id = getRouterParam(event, 'id')!
  const { jobService } = getServices()
  jobService.deleteJob(id)
  setResponseStatus(event, 204)
  return null
})
