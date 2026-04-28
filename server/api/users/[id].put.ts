import { toPublicUser } from '../../types/domain'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    description: 'Update a user by ID.',
    responses: {
      200: { description: 'User updated' },
      400: { description: 'Validation error' },
      404: { description: 'User not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { userService } = getServices()
  return toPublicUser(userService.updateUser(id, body))
})
