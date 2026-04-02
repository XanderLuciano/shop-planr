/**
 * Pure helper that determines whether the Skip button should be visible
 * on the Step View page.
 *
 * Placed in `app/utils/` for Nuxt auto-import and testability.
 */
export function shouldShowSkip(stepOptional: boolean | undefined, isFinalStep: boolean): boolean {
  return stepOptional === true && !isFinalStep
}
