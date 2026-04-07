import { setupPinSchema } from '../../schemas/authSchemas'

export default defineApiHandler(async (event) => {
  const { userId, pin } = await parseBody(event, setupPinSchema)
  const { authService } = getServices()
  const token = await authService.setupPin(userId, pin)
  return { token }
})
