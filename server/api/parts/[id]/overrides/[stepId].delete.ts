export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const stepId = getRouterParam(event, 'stepId')!
    const body = await readBody(event)
    const { lifecycleService } = getServices()
    lifecycleService.reverseStepOverride(id, stepId, body.userId)
    return { success: true }
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
