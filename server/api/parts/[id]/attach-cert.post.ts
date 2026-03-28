export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const body = await readBody(event)
    const { partService, certService, pathService } = getServices()

    const part = partService.getPart(id)
    const path = pathService.getPath(part.pathId)
    const step = part.currentStepIndex >= 0 ? path.steps[part.currentStepIndex] : undefined
    if (!step) {
      throw createError({ statusCode: 400, message: 'Part is already completed, cannot attach cert' })
    }

    return certService.attachCertToSerial({
      certId: body.certId,
      serialId: id,
      stepId: step.id,
      userId: body.userId,
      jobId: part.jobId,
      pathId: part.pathId
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error instanceof NotFoundError) {
      throw createError({ statusCode: 404, message: error.message })
    }
    throw error
  }
})
