export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const body = await readBody(event)
    const { lifecycleService } = getServices()
    return lifecycleService.createStepOverride(body.serialIds, body.stepId, body.reason, body.userId)
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
