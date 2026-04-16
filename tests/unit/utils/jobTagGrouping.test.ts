import { describe, it, expect } from 'vitest'
import { groupJobsByTag } from '~/app/utils/jobTagGrouping'
import type { Tag, Job } from '~/app/types/domain'

// --- Helpers to create minimal mock objects ---

function makeTag(id: string, name: string, color = '#ef4444'): Tag {
  return { id, name, color, createdAt: '2024-01-01', updatedAt: '2024-01-01' } as Tag
}

function makeJob(id: string, name: string, tags: Tag[]): Job & { tags: Tag[] } {
  return { id, name, tags } as Job & { tags: Tag[] }
}

// --- Shared fixtures ---

const tagA = makeTag('tag_a', 'Alpha', '#ef4444')
const tagB = makeTag('tag_b', 'Beta', '#3b82f6')
const tagC = makeTag('tag_c', 'Gamma', '#22c55e')

/**
 * Unit tests for groupJobsByTag utility
 * Validates: Requirements 14.1, 14.2, 14.3
 */
describe('groupJobsByTag', () => {
  it('groups jobs with a single tag into the correct group', () => {
    const jobs = [
      makeJob('j1', 'Job 1', [tagA]),
      makeJob('j2', 'Job 2', [tagA]),
      makeJob('j3', 'Job 3', [tagB]),
    ]

    const groups = groupJobsByTag(jobs, [tagA, tagB])

    expect(groups).toHaveLength(2)
    expect(groups[0].tag).toEqual(tagA)
    expect(groups[0].jobs.map(j => j.id)).toEqual(['j1', 'j2'])
    expect(groups[1].tag).toEqual(tagB)
    expect(groups[1].jobs.map(j => j.id)).toEqual(['j3'])
  })

  it('duplicates jobs with multiple tags into each matching group', () => {
    const jobs = [
      makeJob('j1', 'Job 1', [tagA, tagB]),
      makeJob('j2', 'Job 2', [tagB]),
    ]

    const groups = groupJobsByTag(jobs, [tagA, tagB])

    expect(groups).toHaveLength(2)
    // j1 appears in both groups
    expect(groups[0].tag).toEqual(tagA)
    expect(groups[0].jobs.map(j => j.id)).toEqual(['j1'])
    expect(groups[1].tag).toEqual(tagB)
    expect(groups[1].jobs.map(j => j.id)).toEqual(['j1', 'j2'])
  })

  it('places untagged jobs in a group with tag: null at the bottom', () => {
    const jobs = [
      makeJob('j1', 'Job 1', [tagA]),
      makeJob('j2', 'Job 2', []),
      makeJob('j3', 'Job 3', []),
    ]

    const groups = groupJobsByTag(jobs, [tagA])

    expect(groups).toHaveLength(2)
    expect(groups[0].tag).toEqual(tagA)
    expect(groups[0].jobs.map(j => j.id)).toEqual(['j1'])
    // Untagged group is last
    expect(groups[1].tag).toBeNull()
    expect(groups[1].jobs.map(j => j.id)).toEqual(['j2', 'j3'])
  })

  it('returns empty array when jobs array is empty', () => {
    const groups = groupJobsByTag([], [tagA, tagB, tagC])
    expect(groups).toEqual([])
  })

  it('orders groups by the allTags array order', () => {
    const jobs = [
      makeJob('j1', 'Job 1', [tagC]),
      makeJob('j2', 'Job 2', [tagA]),
      makeJob('j3', 'Job 3', [tagB]),
    ]

    // allTags order: B, C, A — groups should follow this order
    const groups = groupJobsByTag(jobs, [tagB, tagC, tagA])

    expect(groups.map(g => g.tag?.id)).toEqual(['tag_b', 'tag_c', 'tag_a'])
  })

  it('excludes empty groups (tags with no matching jobs)', () => {
    const jobs = [
      makeJob('j1', 'Job 1', [tagA]),
    ]

    // tagB and tagC have no jobs — should not appear
    const groups = groupJobsByTag(jobs, [tagA, tagB, tagC])

    expect(groups).toHaveLength(1)
    expect(groups[0].tag).toEqual(tagA)
  })

  it('shows only matching groups when used with a tag filter', () => {
    const jobs = [
      makeJob('j1', 'Job 1', [tagA]),
      makeJob('j2', 'Job 2', [tagB]),
      makeJob('j3', 'Job 3', [tagA, tagB]),
    ]

    // Simulate tag filter: pre-filter jobs to only those with tagA
    const filteredJobs = jobs.filter(j => j.tags.some(t => t.id === 'tag_a'))
    const groups = groupJobsByTag(filteredJobs, [tagA, tagB])

    // tagA group has j1 and j3; tagB group has j3 (since j3 has both tags)
    expect(groups).toHaveLength(2)
    expect(groups[0].tag).toEqual(tagA)
    expect(groups[0].jobs.map(j => j.id)).toEqual(['j1', 'j3'])
    expect(groups[1].tag).toEqual(tagB)
    expect(groups[1].jobs.map(j => j.id)).toEqual(['j3'])
  })

  it('handles jobs where tags is undefined/falsy as untagged', () => {
    const jobNoTags = { id: 'j1', name: 'Job 1', tags: undefined } as unknown as Job & { tags: Tag[] }
    const groups = groupJobsByTag([jobNoTags], [tagA])

    expect(groups).toHaveLength(1)
    expect(groups[0].tag).toBeNull()
    expect(groups[0].jobs).toHaveLength(1)
  })
})
