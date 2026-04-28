import { updateTagSchema } from '../../schemas/tagSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Tags'],
    description: 'Update a tag (admin only).',
    requestBody: zodRequestBody(updateTagSchema),
    responses: {
      200: { description: 'Tag updated' },
      400: { description: 'Validation error' },
      404: { description: 'Tag not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Tag ID is required')
  const userId = getAuthUserId(event)
  const body = await parseBody(event, updateTagSchema)
  const { tagService } = getServices()
  return tagService.updateTag(userId, id, body)
})
