import { toPublicUser } from '../../types/domain'

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { userService } = getServices()
  return toPublicUser(userService.updateUser(id, body))
})
