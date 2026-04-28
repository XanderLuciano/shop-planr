import { updateAdvancementModeSchema } from '../../../schemas/pathSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Paths'],
    description: 'Update the advancement mode for a path.',
    requestBody: zodRequestBody(updateAdvancementModeSchema),
    responses: {
      200: { description: 'Advancement mode updated' },
      400: { description: 'Validation error' },
      404: { description: 'Path not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, updateAdvancementModeSchema)
  const { pathService } = getServices()
  return pathService.updatePath(id, { advancementMode: body.advancementMode })
})
