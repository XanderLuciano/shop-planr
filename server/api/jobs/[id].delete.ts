defineRouteMeta({
  openAPI: {
    tags: ['Jobs'],
    description: 'Delete a job by ID (admin only).',
    responses: {
      204: { description: 'Job deleted' },
      404: { description: 'Job not found' },
    },
  },
})

export default defineApiHandler((event) => {
  const id = getRouterParam(event, 'id')!
  const { jobService } = getServices()
  // Look up job info before deletion for the webhook payload
  const job = jobService.getJob(id)
  jobService.deleteJob(id)
  emitWebhookEvent('job_deleted', {
    user: 'system',
    jobId: id,
    jobName: job.name,
  })
  setResponseStatus(event, 204)
  return null
})
