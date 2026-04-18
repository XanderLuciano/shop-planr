import { batchStepStatusesSchema } from '../../schemas/partSchemas'
import type { PartStepStatusView } from '../../types/computed'

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, batchStepStatusesSchema)
  const { lifecycleService } = getServices()
  const { paths, parts, partStepOverrides } = getRepositories()

  const result: Record<string, PartStepStatusView[]> = {}

  for (const partId of body.partIds) {
    try {
      const allStatuses = lifecycleService.getStepStatuses(partId)

      // Deduplicate by stepId, keeping the latest (highest sequenceNumber)
      const latestByStep = new Map<string, typeof allStatuses[number]>()
      for (const s of allStatuses) {
        const existing = latestByStep.get(s.stepId)
        if (!existing || s.sequenceNumber > existing.sequenceNumber) {
          latestByStep.set(s.stepId, s)
        }
      }

      const part = parts.getById(partId)
      if (!part) continue

      const path = paths.getById(part.pathId)
      if (!path) {
        const statuses = [...latestByStep.values()]
        result[partId] = statuses.map(s => ({
          stepId: s.stepId,
          stepName: '',
          stepOrder: 0,
          status: s.status,
          optional: false,
          dependencyType: 'preferred' as const,
          hasOverride: false,
        }))
        continue
      }

      // Get overrides
      const overrides = partStepOverrides.listByPartId(partId)
      const activeOverrideStepIds = new Set(overrides.filter(o => o.active).map(o => o.stepId))

      result[partId] = path.steps.map((step) => {
        const latest = latestByStep.get(step.id)
        return {
          stepId: step.id,
          stepName: step.name,
          stepOrder: step.order,
          status: latest?.status ?? 'pending',
          optional: step.optional,
          dependencyType: step.dependencyType,
          hasOverride: activeOverrideStepIds.has(step.id),
        }
      })
    } catch {
      // Omit missing parts — no error
    }
  }

  return result
})
