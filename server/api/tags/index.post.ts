import { createTagSchema } from '../../schemas/tagSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Tags'],
    description: 'Create a new tag (admin only).',
    requestBody: zodRequestBody(createTagSchema),
    responses: {
      201: { description: 'Tag created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const userId = getAuthUserId(event)
  const body = await parseBody(event, createTagSchema)
  const { tagService } = getServices()
  return tagService.createTag(userId, body)
})
