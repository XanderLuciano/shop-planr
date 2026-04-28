import { toPublicUser } from '../../types/domain'
import { updateUserSchema } from '../../schemas/userSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    description: 'Update a user by ID.',
    requestBody: zodRequestBody(updateUserSchema),
    responses: {
      200: { description: 'User updated' },
      400: { description: 'Validation error' },
      404: { description: 'User not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, updateUserSchema)
  const { userService } = getServices()
  return toPublicUser(userService.updateUser(id, body))
})
