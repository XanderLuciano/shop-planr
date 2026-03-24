export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const body = await readBody(event)
    const { serialService, certService, pathService } = getServices()

    const serial = serialService.getSerial(id)
    const path = pathService.getPath(serial.pathId)
    const step = serial.currentStepIndex >= 0 ? path.steps[serial.currentStepIndex] : undefined
    if (!step) {
      throw createError({ statusCode: 400, message: 'Serial is already completed, cannot attach cert' })
    }

    return certService.attachCertToSerial({
      certId: body.certId,
      serialId: id,
      stepId: step.id,
      userId: body.userId,
      jobId: serial.jobId,
      pathId: serial.pathId
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
