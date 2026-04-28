import { toPublicUser } from '../../types/domain'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    description: 'List all active users.',
    responses: {
      200: { description: 'List of users' },
    },
  },
})

export default defineApiHandler(async () => {
  const { userService } = getServices()
  return userService.listActiveUsers().map(toPublicUser)
})
