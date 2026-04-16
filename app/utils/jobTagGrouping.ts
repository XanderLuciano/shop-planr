import type { Job, Tag } from '~/types/domain'

export interface JobTagGroup {
  tag: Tag | null // null = "Untagged" group
  jobs: (Job & { tags: readonly Tag[] })[]
}

/**
 * Groups jobs by their tags. Jobs with multiple tags appear in each matching group.
 * Untagged jobs go into a `{ tag: null }` group at the bottom.
 * Groups are ordered by the `allTags` array order (consistent ordering).
 */
export function groupJobsByTag(
  jobs: readonly (Job & { tags: readonly Tag[] })[],
  allTags: readonly Tag[],
): JobTagGroup[] {
  const groupMap = new Map<string, (Job & { tags: readonly Tag[] })[]>()
  const untagged: (Job & { tags: readonly Tag[] })[] = []

  for (const job of jobs) {
    if (!job.tags?.length) {
      untagged.push(job)
      continue
    }
    for (const tag of job.tags) {
      const list = groupMap.get(tag.id) ?? []
      list.push(job)
      groupMap.set(tag.id, list)
    }
  }

  const groups: JobTagGroup[] = []
  for (const tag of allTags) {
    const tagJobs = groupMap.get(tag.id)
    if (tagJobs?.length) {
      groups.push({ tag, jobs: tagJobs })
    }
  }
  if (untagged.length) {
    groups.push({ tag: null, jobs: untagged })
  }
  return groups
}
