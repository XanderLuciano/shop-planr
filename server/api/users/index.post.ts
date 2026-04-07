import { toPublicUser } from '../../types/domain'

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { userService } = getServices()
  return toPublicUser(userService.createUser(body))
})
