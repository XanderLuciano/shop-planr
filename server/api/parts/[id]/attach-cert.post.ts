export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { partService, certService, pathService } = getServices()

  const part = partService.getPart(id)
  const path = pathService.getPath(part.pathId)
  const step = part.currentStepId !== null ? path.steps.find(s => s.id === part.currentStepId) : undefined
  if (!step) {
    throw new ValidationError('Part is already completed, cannot attach cert')
  }

  return certService.attachCertToSerial({
    certId: body.certId,
    serialId: id,
    stepId: step.id,
    userId: body.userId,
    jobId: part.jobId,
    pathId: part.pathId,
  })
})
