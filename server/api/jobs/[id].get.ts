export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { jobService, pathService } = getServices()
  const job = jobService.getJob(id)
  const paths = pathService.listPathsByJob(id)
  const progress = jobService.computeJobProgress(id)
  return { ...job, paths, progress }
})
