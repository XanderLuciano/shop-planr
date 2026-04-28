import { toPublicUser } from '../../types/domain'
import { createUserSchema } from '../../schemas/userSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    description: 'Create a new user.',
    requestBody: zodRequestBody(createUserSchema),
    responses: {
      201: { description: 'User created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createUserSchema)
  const { userService } = getServices()
  return toPublicUser(userService.createUser(body))
})
