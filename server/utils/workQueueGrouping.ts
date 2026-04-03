import type { WorkQueueJob, WorkQueueGroup, GroupByDimension } from '../types/computed'

interface WorkQueueEntry {
  job: WorkQueueJob
  assignedTo?: string
  location?: string
}

/**
 * Groups work queue entries by the requested dimension and returns
 * sorted, labelled groups with computed totalParts.
 *
 * - 'user':     groups by assignedTo, labels via userNameMap, null → "Unassigned"
 * - 'location': groups by job.stepLocation, null/undefined → "No Location"
 * - 'step':     groups by job.stepName, null/undefined → "Unknown Step"
 *
 * Jobs within each group are sorted by jobPriority descending.
 * Empty groups (0 jobs) are excluded.
 */
export function groupEntriesByDimension(
  entries: WorkQueueEntry[],
  dimension: GroupByDimension,
  userNameMap: Map<string, string>,
): WorkQueueGroup[] {
  const groupMap = new Map<string | null, WorkQueueJob[]>()

  for (const entry of entries) {
    const key = extractGroupKey(entry, dimension)
    const list = groupMap.get(key)
    if (list) {
      list.push(entry.job)
    } else {
      groupMap.set(key, [entry.job])
    }
  }

  const groups: WorkQueueGroup[] = []

  for (const [key, jobs] of groupMap) {
    if (jobs.length === 0) continue

    // Sort by jobPriority descending (highest first).
    jobs.sort((a, b) => (getPriority(b) - getPriority(a)))

    const totalParts = jobs.reduce((sum, j) => sum + j.partCount, 0)
    const label = resolveGroupLabel(key, dimension, userNameMap)

    groups.push({
      groupKey: key,
      groupLabel: label,
      groupType: dimension,
      jobs,
      totalParts,
    })
  }

  return groups
}

function getPriority(job: WorkQueueJob): number {
  return job.jobPriority ?? 0
}

function extractGroupKey(entry: WorkQueueEntry, dimension: GroupByDimension): string | null {
  switch (dimension) {
    case 'user':
      return entry.assignedTo ?? null
    case 'location':
      return entry.job.stepLocation ?? null
    case 'step':
      return entry.job.stepName ?? null
  }
}

function resolveGroupLabel(
  key: string | null,
  dimension: GroupByDimension,
  userNameMap: Map<string, string>,
): string {
  if (key === null) {
    switch (dimension) {
      case 'user': return 'Unassigned'
      case 'location': return 'No Location'
      case 'step': return 'Unknown Step'
    }
  }

  if (dimension === 'user') {
    return userNameMap.get(key) ?? key
  }

  return key
}
