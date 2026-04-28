import { updateTemplateSchema } from '../../schemas/templateSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Templates'],
    description: 'Update a route template.',
    requestBody: zodRequestBody(updateTemplateSchema),
    responses: {
      200: { description: 'Template updated' },
      400: { description: 'Validation error' },
      404: { description: 'Template not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, updateTemplateSchema)
  const { templateService } = getServices()
  return templateService.updateTemplate(id, body)
})
