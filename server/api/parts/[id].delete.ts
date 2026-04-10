import { partIdParamSchema } from '../../schemas/partSchemas'

export default defineApiHandler((event) => {
  const parseResult = partIdParamSchema.safeParse({ id: getRouterParam(event, 'id') })
  if (!parseResult.success) {
    throw new ValidationError(
      parseResult.error.issues.map(i => i.message).join('; '),
    )
  }
  const { id } = parseResult.data
  const userId = getAuthUserId(event)
  const { partService } = getServices()
  const result = partService.deletePart(id, userId)
  return { success: true, ...result }
})
