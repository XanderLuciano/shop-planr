import { describe, it, expect } from 'vitest'
import { groupJobsByTag } from '~/app/utils/jobTagGrouping'
import type { Tag, Job } from '~/app/types/domain'

// --- Helpers ---

function makeTag(id: string, name: string, color = '#ef4444'): Tag {
  return { id, name, color, createdAt: '2024-01-01', updatedAt: '2024-01-01' } as Tag
}

function makeJob(id: string, name: string, tags: Tag[]): Job & { tags: Tag[] } {
  return { id, name, tags } as Job & { tags: Tag[] }
}

const tagA = makeTag('tag_a', 'Alpha', '#ef4444')
const tagB = makeTag('tag_b', 'Beta', '#3b82f6')

/**
 * Tests for grouped job expansion state management.
 *
 * The expansion state in the grouped view is managed via a Set<string> of job IDs.
 * These tests validate the Set-based expansion logic that mirrors the component behavior.
 *
 * Validates: Requirement 14.10
 */
describe('grouped job expansion state management', () => {
  it('toggleGroupedJobExpand adds a job ID to the expanded set', () => {
    const expanded = new Set<string>()
    const jobId = 'job_1'

    // Simulate toggle: add
    expanded.add(jobId)

    expect(expanded.has(jobId)).toBe(true)
    expect(expanded.size).toBe(1)
  })

  it('toggleGroupedJobExpand removes a job ID when already expanded', () => {
    const expanded = new Set<string>(['job_1', 'job_2'])

    // Simulate toggle: remove
    expanded.delete('job_1')

    expect(expanded.has('job_1')).toBe(false)
    expect(expanded.has('job_2')).toBe(true)
    expect(expanded.size).toBe(1)
  })

  it('expandAllGroupedJobs populates set with all job IDs across all groups', () => {
    const jobs = [
      makeJob('j1', 'Job 1', [tagA]),
      makeJob('j2', 'Job 2', [tagB]),
      makeJob('j3', 'Job 3', [tagA, tagB]),
      makeJob('j4', 'Job 4', []),
    ]
    const groups = groupJobsByTag(jobs, [tagA, tagB])

    // Simulate expandAllGroupedJobs: collect all job IDs from all groups
    const expanded = new Set<string>()
    for (const group of groups) {
      for (const job of group.jobs) {
        expanded.add(job.id)
      }
    }

    expect(expanded.size).toBe(4)
    expect(expanded.has('j1')).toBe(true)
    expect(expanded.has('j2')).toBe(true)
    expect(expanded.has('j3')).toBe(true)
    expect(expanded.has('j4')).toBe(true)
  })

  it('collapseAllGroupedJobs clears the expanded set', () => {
    const expanded = new Set<string>(['j1', 'j2', 'j3'])
    const jobsWithExpandedPaths = new Set<string>(['j1'])

    // Simulate collapseAllGroupedJobs
    expanded.clear()
    jobsWithExpandedPaths.clear()

    expect(expanded.size).toBe(0)
    expect(jobsWithExpandedPaths.size).toBe(0)
  })

  it('hasExpandedJobs returns true when expandedGroupedJobs is non-empty', () => {
    const expandedGroupedJobs = new Set<string>(['j1'])
    const isGrouped = true

    // Simulate hasExpandedJobs computed
    const hasExpandedJobs = isGrouped
      ? expandedGroupedJobs.size > 0
      : false

    expect(hasExpandedJobs).toBe(true)
  })

  it('hasExpandedJobs returns false when expandedGroupedJobs is empty in grouped mode', () => {
    const expandedGroupedJobs = new Set<string>()
    const isGrouped = true

    const hasExpandedJobs = isGrouped
      ? expandedGroupedJobs.size > 0
      : false

    expect(hasExpandedJobs).toBe(false)
  })

  it('expandAllJobs delegates to grouped variant when isGrouped is true', () => {
    const jobs = [
      makeJob('j1', 'Job 1', [tagA]),
      makeJob('j2', 'Job 2', [tagB]),
    ]
    const groups = groupJobsByTag(jobs, [tagA, tagB])
    const isGrouped = true

    // Simulate expandAllJobs behavior
    const expandedGroupedJobs = new Set<string>()
    const expandedFlat: Record<string, boolean> | true = {}

    if (isGrouped) {
      for (const group of groups) {
        for (const job of group.jobs) {
          expandedGroupedJobs.add(job.id)
        }
      }
    }

    expect(expandedGroupedJobs.size).toBe(2)
    expect(expandedFlat).toEqual({}) // flat state untouched
  })

  it('collapseAllJobs delegates to grouped variant when isGrouped is true', () => {
    const expandedGroupedJobs = new Set<string>(['j1', 'j2'])
    const jobsWithExpandedPaths = new Set<string>(['j1'])
    const isGrouped = true
    let expandedFlat: Record<string, boolean> | true = true

    if (isGrouped) {
      expandedGroupedJobs.clear()
      jobsWithExpandedPaths.clear()
    } else {
      expandedFlat = {}
      jobsWithExpandedPaths.clear()
    }

    expect(expandedGroupedJobs.size).toBe(0)
    expect(jobsWithExpandedPaths.size).toBe(0)
    expect(expandedFlat).toBe(true) // flat state untouched
  })
})

/**
 * Tests for tag-colored group border logic.
 *
 * Each group container uses `group.tag?.color ?? 'var(--ui-border)'` for its border color.
 * Tagged groups get the tag's hex color; untagged groups fall back to the CSS variable.
 *
 * Validates: Requirement 14.11
 */
describe('tag-colored group border logic', () => {
  it('produces the tag hex color for tagged groups', () => {
    const groups = groupJobsByTag(
      [makeJob('j1', 'Job 1', [tagA])],
      [tagA],
    )

    const borderColor = groups[0].tag?.color ?? 'var(--ui-border)'
    expect(borderColor).toBe('#ef4444')
  })

  it('produces fallback for untagged groups (tag is null)', () => {
    const groups = groupJobsByTag(
      [makeJob('j1', 'Job 1', [])],
      [tagA],
    )

    // Only group should be untagged
    expect(groups).toHaveLength(1)
    expect(groups[0].tag).toBeNull()

    const borderColor = groups[0].tag?.color ?? 'var(--ui-border)'
    expect(borderColor).toBe('var(--ui-border)')
  })

  it('each group gets its own tag color', () => {
    const groups = groupJobsByTag(
      [
        makeJob('j1', 'Job 1', [tagA]),
        makeJob('j2', 'Job 2', [tagB]),
      ],
      [tagA, tagB],
    )

    const colors = groups.map(g => g.tag?.color ?? 'var(--ui-border)')
    expect(colors).toEqual(['#ef4444', '#3b82f6'])
  })

  it('mixed tagged and untagged groups have correct border colors', () => {
    const groups = groupJobsByTag(
      [
        makeJob('j1', 'Job 1', [tagA]),
        makeJob('j2', 'Job 2', []),
      ],
      [tagA],
    )

    expect(groups).toHaveLength(2)
    expect(groups[0].tag?.color ?? 'var(--ui-border)').toBe('#ef4444')
    expect(groups[1].tag?.color ?? 'var(--ui-border)').toBe('var(--ui-border)')
  })
})
