import { deleteTagQuerySchema } from '../../schemas/tagSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Tags'],
    description: 'Delete a tag by ID (admin only, optional force cascade).',
    responses: {
      204: { description: 'Tag deleted' },
      404: { description: 'Tag not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw new ValidationError('Tag ID is required')
  const userId = getAuthUserId(event)
  const { force } = parseQuery(event, deleteTagQuerySchema)
  const { tagService } = getServices()
  await tagService.deleteTag(userId, id, force)
  return sendNoContent(event)
})
