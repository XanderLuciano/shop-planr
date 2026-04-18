import { batchPathOperationsSchema } from '../../../../schemas/pathSchemas'
import type { Path } from '../../../../types/domain'

export default defineApiHandler(async (event) => {
  const jobId = getRouterParam(event, 'id')!
  const body = await parseBody(event, batchPathOperationsSchema)
  const userId = getAuthUserId(event)
  const { pathService, jobService } = getServices()

  // Verify job exists — throws NotFoundError → 404
  jobService.getJob(jobId)

  const deleted: string[] = []
  const updated: Path[] = []
  const created: Path[] = []

  // Deletes first
  for (const pathId of body.delete) {
    pathService.deletePath(pathId, userId)
    deleted.push(pathId)
  }

  // Then updates
  for (const op of body.update) {
    const { pathId, ...updateData } = op
    const result = pathService.updatePath(pathId, updateData)
    updated.push(result)
  }

  // Then creates
  for (const op of body.create) {
    const result = pathService.createPath({ ...op, jobId })
    created.push(result)
  }

  return { created, updated, deleted }
})
