interface PartInfo {
  partId: string
  jobId: string
  jobName: string
  pathId: string
  pathName: string
  nextStepName?: string
  nextStepLocation?: string
}

export default defineApiHandler(async (event) => {
  const stepName = getRouterParam(event, 'stepName')!
  const { jobService, pathService, partService } = getServices()
  const jobs = jobService.listJobs()

  const currentParts: PartInfo[] = []
  const comingSoon: PartInfo[] = []
  const backlog: PartInfo[] = []
  let vendorPartsCount = 0
  let location: string | undefined
  const stepIdSet = new Set<string>()

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)
    for (const path of paths) {
      const stepIndex = path.steps.findIndex(s => s.name === stepName)
      if (stepIndex === -1) continue

      const step = path.steps[stepIndex]!
      if (!location && step.location) {
        location = step.location
      }
      stepIdSet.add(step.id)

      // Current parts at this step
      const atStep = partService.listPartsByCurrentStepId(step.id)
      for (const sn of atStep) {
        const nextStep = path.steps.find(s => s.order === step.order + 1)
        currentParts.push({
          partId: sn.id,
          jobId: job.id,
          jobName: job.name,
          pathId: path.id,
          pathName: path.name,
          nextStepName: nextStep?.name,
          nextStepLocation: nextStep?.location,
        })
      }

      // Coming soon (one step before by order)
      const prevStep = path.steps.find(s => s.order === step.order - 1)
      if (prevStep) {
        const upstream = partService.listPartsByCurrentStepId(prevStep.id)
        for (const sn of upstream) {
          comingSoon.push({
            partId: sn.id,
            jobId: job.id,
            jobName: job.name,
            pathId: path.id,
            pathName: path.name,
          })
        }
      }

      // Backlog (two+ steps before by order)
      for (const s of path.steps) {
        if (s.order >= step.order - 1) continue
        const far = partService.listPartsByCurrentStepId(s.id)
        for (const sn of far) {
          backlog.push({
            partId: sn.id,
            jobId: job.id,
            jobName: job.name,
            pathId: path.id,
            pathName: path.name,
          })
        }
      }

      // Vendor parts: if step has a location containing "vendor" (case-insensitive)
      if (step.location?.toLowerCase().includes('vendor')) {
        vendorPartsCount += atStep.length
      }
    }
  }

  const result = {
    stepName,
    location,
    currentParts,
    comingSoon,
    backlog,
    vendorPartsCount,
    stepIds: [...stepIdSet],
  }

  return result
})
