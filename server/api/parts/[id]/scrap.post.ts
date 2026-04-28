import { scrapPartSchema } from '../../../schemas/partSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Parts'],
    description: 'Scrap a part with a reason.',
    requestBody: zodRequestBody(scrapPartSchema),
    responses: {
      200: { description: 'Part scrapped' },
      400: { description: 'Validation error' },
      404: { description: 'Part not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, scrapPartSchema)
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()
  return lifecycleService.scrapPart(id, { ...body, userId })
})
