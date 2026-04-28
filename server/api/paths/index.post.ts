import { createPathSchema } from '../../schemas/pathSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Paths'],
    description: 'Create a new manufacturing path with ordered process steps.',
    requestBody: zodRequestBody(createPathSchema),
    responses: {
      201: { description: 'Path created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createPathSchema)
  const { pathService } = getServices()
  return pathService.createPath(body)
})
