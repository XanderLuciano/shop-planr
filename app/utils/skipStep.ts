/**
 * Pure skip-step logic extracted from the Step View page.
 *
 * Validates inputs and dispatches advanceToStep calls for each part.
 * Placed in `app/utils/` for Nuxt auto-import and testability.
 */

export interface SkipStepParams {
  partIds: string[]
  operatorId: string | null
  nextStepId: string | undefined
  advanceToStep: (partId: string, input: { targetStepId: string, userId: string }) => Promise<unknown>
}

export interface SkipStepResult {
  skipped: boolean
  count: number
  error?: string
}

export async function executeSkip(params: SkipStepParams): Promise<SkipStepResult> {
  const { partIds, operatorId, nextStepId, advanceToStep } = params

  if (!operatorId) {
    return { skipped: false, count: 0, error: 'Operator required' }
  }

  if (!nextStepId) {
    return { skipped: false, count: 0, error: 'No next step' }
  }

  for (const partId of partIds) {
    await advanceToStep(partId, {
      targetStepId: nextStepId,
      userId: operatorId,
    })
  }

  return { skipped: true, count: partIds.length }
}
