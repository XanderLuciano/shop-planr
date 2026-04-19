import { batchAdvanceToSchema } from '../../schemas/partSchemas'

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchAdvanceToSchema)
  const userId = getAuthUserId(event)
  const { lifecycleService } = getServices()

  const results: { partId: string, success: boolean, error?: string }[] = []
  let advanced = 0
  let failed = 0

  for (const partId of body.partIds) {
    try {
      lifecycleService.advanceToStep(partId, {
        targetStepId: body.targetStepId,
        skip: body.skip,
        userId,
      })
      results.push({ partId, success: true })
      advanced++
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.push({ partId, success: false, error: message })
      failed++
    }
  }

  return { advanced, failed, results }
})
