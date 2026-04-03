import type { WorkQueueGroup, WorkQueueFilterState } from '~/types/computed'

/**
 * Apply property filters and text search to work queue groups.
 *
 * - Property filters use AND logic: a job must match ALL active filters.
 * - Text search uses OR logic across fields (jobName, stepName, stepLocation,
 *   groupLabel) with case-insensitive substring matching.
 * - When both are active, a job must pass BOTH.
 * - Empty groups (all jobs filtered out) are excluded.
 * - When all filters are empty/undefined and searchQuery is empty, returns input unchanged.
 * - Preserves original group and job ordering.
 * - Recomputes `totalParts` for each filtered group.
 */
export function applyFilters(
  groups: WorkQueueGroup[],
  filters: WorkQueueFilterState,
  searchQuery: string,
): WorkQueueGroup[] {
  const hasLocation = !!filters.location
  const hasStepName = !!filters.stepName
  const hasUserId = !!filters.userId
  const q = searchQuery.trim().toLowerCase()
  const hasSearch = q.length > 0

  // Fast path: no filters active → return input unchanged
  if (!hasLocation && !hasStepName && !hasUserId && !hasSearch) {
    return groups
  }

  const result: WorkQueueGroup[] = []

  for (const group of groups) {
    const filteredJobs = group.jobs.filter((job) => {
      // Property filters (AND logic)
      if (hasLocation && job.stepLocation !== filters.location) return false
      if (hasStepName && job.stepName !== filters.stepName) return false
      // userId filter: match against job.assignedTo (works across all group types)
      if (hasUserId && job.assignedTo !== filters.userId) return false

      // Text search (OR across fields, case-insensitive substring)
      if (hasSearch) {
        const matchesJobName = job.jobName.toLowerCase().includes(q)
        const matchesStepName = job.stepName.toLowerCase().includes(q)
        const matchesLocation = job.stepLocation?.toLowerCase().includes(q) ?? false
        const matchesGroupLabel = group.groupLabel.toLowerCase().includes(q)
        if (!matchesJobName && !matchesStepName && !matchesLocation && !matchesGroupLabel) {
          return false
        }
      }

      return true
    })

    if (filteredJobs.length > 0) {
      result.push({
        ...group,
        jobs: filteredJobs,
        totalParts: filteredJobs.reduce((sum, j) => sum + j.partCount, 0),
      })
    }
  }

  return result
}

/**
 * Extract unique, sorted available filter values from all jobs across all groups.
 *
 * - `locations`: unique sorted non-empty `job.stepLocation` values
 * - `stepNames`: unique sorted non-empty `job.stepName` values
 * - `userIds`: unique sorted non-empty `job.assignedTo` values
 */
export function extractAvailableValues(
  groups: WorkQueueGroup[],
): { locations: string[]; stepNames: string[]; userIds: string[] } {
  const locationSet = new Set<string>()
  const stepNameSet = new Set<string>()
  const userIdSet = new Set<string>()

  for (const group of groups) {
    for (const job of group.jobs) {
      if (job.stepLocation) locationSet.add(job.stepLocation)
      if (job.stepName) stepNameSet.add(job.stepName)
      if (job.assignedTo) userIdSet.add(job.assignedTo)
    }
  }

  return {
    locations: [...locationSet].sort(),
    stepNames: [...stepNameSet].sort(),
    userIds: [...userIdSet].sort(),
  }
}
