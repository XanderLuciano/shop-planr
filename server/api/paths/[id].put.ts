import { updatePathSchema } from '../../schemas/pathSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Paths'],
    description: 'Update an existing path (name, goal quantity, steps).',
    requestBody: zodRequestBody(updatePathSchema),
    responses: {
      200: { description: 'Path updated' },
      400: { description: 'Validation error' },
      404: { description: 'Path not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, updatePathSchema)
  const { pathService } = getServices()
  return pathService.updatePath(id, body)
})
