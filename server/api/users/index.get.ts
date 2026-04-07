import { toPublicUser } from '../../types/domain'

export default defineApiHandler(async () => {
  const { userService } = getServices()
  return userService.listActiveUsers().map(toPublicUser)
})
