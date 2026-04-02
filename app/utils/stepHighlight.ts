/**
 * Pure helper that determines whether a step should receive
 * the blue "has parts" highlight in the StepTracker.
 *
 * Placed in `app/utils/` for Nuxt auto-import.
 */

export function shouldHighlightStep(partCount: number, isBottleneck: boolean): boolean {
  return partCount > 0 && !isBottleneck
}
