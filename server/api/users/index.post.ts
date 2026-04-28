import { toPublicUser } from '../../types/domain'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    description: 'Create a new user.',
    responses: {
      201: { description: 'User created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { userService } = getServices()
  return toPublicUser(userService.createUser(body))
})
