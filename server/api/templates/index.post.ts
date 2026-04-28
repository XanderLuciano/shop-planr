import { createTemplateSchema } from '../../schemas/templateSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Templates'],
    description: 'Create a new route template.',
    requestBody: zodRequestBody(createTemplateSchema),
    responses: {
      201: { description: 'Template created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, createTemplateSchema)
  const { templateService } = getServices()
  return templateService.createTemplate(body)
})
