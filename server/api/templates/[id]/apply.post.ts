import { applyTemplateSchema } from '../../../schemas/templateSchemas'

defineRouteMeta({
  openAPI: {
    tags: ['Templates'],
    description: 'Apply a template to create a path on a job.',
    requestBody: zodRequestBody(applyTemplateSchema),
    responses: {
      201: { description: 'Path created from template' },
      400: { description: 'Validation error' },
      404: { description: 'Template not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await parseBody(event, applyTemplateSchema)
  const { templateService } = getServices()
  return templateService.applyTemplate(id, body)
})
