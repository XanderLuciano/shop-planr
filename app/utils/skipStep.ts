/**
 * Pure skip-step logic extracted from the Step View page.
 *
 * Validates inputs and dispatches a single batchAdvanceToStep call for all parts.
 * Placed in `app/utils/` for Nuxt auto-import and testability.
 */

export interface SkipStepParams {
  partIds: string[]
  nextStepId: string | undefined
  batchAdvanceToStep: (input: {
    partIds: string[]
    targetStepId: string
    skip?: boolean
  }) => Promise<{ advanced: number, failed: number, results: { partId: string, success: boolean, error?: string }[] }>
}

export interface SkipStepResult {
  skipped: boolean
  count: number
  error?: string
}

export async function executeSkip(params: SkipStepParams): Promise<SkipStepResult> {
  const { partIds, nextStepId, batchAdvanceToStep } = params

  if (!nextStepId) {
    return { skipped: false, count: 0, error: 'No next step' }
  }

  const result = await batchAdvanceToStep({
    partIds,
    targetStepId: nextStepId,
    skip: true,
  })

  return { skipped: true, count: result.advanced }
}
