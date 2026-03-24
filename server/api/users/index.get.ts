export default defineEventHandler(async () => {
  try {
    const { userService } = getServices()
    return userService.listActiveUsers()
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
