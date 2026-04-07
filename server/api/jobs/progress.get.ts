export default defineApiHandler(async () => {
  const { jobService } = getServices()
  return jobService.computeAllJobProgress()
})
