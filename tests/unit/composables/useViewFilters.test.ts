import { describe, it, expect, beforeEach, vi } from 'vitest'

// We test the applyFilters logic directly by importing the composable
// Since the composable uses module-level state, we test the returned functions
import { useViewFilters } from '~/app/composables/useViewFilters'

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

describe('useViewFilters', () => {
  beforeEach(() => {
    localStorageMock.clear()
    const { clearFilters } = useViewFilters()
    clearFilters()
  })

  it('returns default filter state with status "all"', () => {
    const { filters } = useViewFilters()
    expect(filters.value.status).toBe('all')
  })

  it('updateFilter sets a single filter key', () => {
    const { filters, updateFilter } = useViewFilters()
    updateFilter('jobName', 'Test Job')
    expect(filters.value.jobName).toBe('Test Job')
  })

  it('clearFilters resets to defaults', () => {
    const { filters, updateFilter, clearFilters } = useViewFilters()
    updateFilter('jobName', 'Test')
    updateFilter('priority', 'High')
    clearFilters()
    expect(filters.value).toEqual({ status: 'all', tagIds: [], groupByTag: false })
  })

  it('applyFilters filters by jobName (case-insensitive)', () => {
    const { updateFilter, applyFilters } = useViewFilters()
    updateFilter('jobName', 'alpha')

    const items = [
      { name: 'Alpha Job', id: '1' },
      { name: 'Beta Job', id: '2' },
      { name: 'ALPHA-2', id: '3' },
    ]

    const result = applyFilters(items, { jobName: i => i.name })
    expect(result.map(i => i.id)).toEqual(['1', '3'])
  })

  it('applyFilters filters by status', () => {
    const { updateFilter, applyFilters } = useViewFilters()
    updateFilter('status', 'completed')

    const items = [
      { id: '1', done: true },
      { id: '2', done: false },
      { id: '3', done: true },
    ]

    const result = applyFilters(items, {
      status: i => i.done ? 'completed' : 'active',
    })
    expect(result.map(i => i.id)).toEqual(['1', '3'])
  })

  it('applyFilters with status "all" returns everything', () => {
    const { filters, applyFilters } = useViewFilters()
    expect(filters.value.status).toBe('all')

    const items = [
      { id: '1', done: true },
      { id: '2', done: false },
    ]

    const result = applyFilters(items, {
      status: i => i.done ? 'completed' : 'active',
    })
    expect(result).toHaveLength(2)
  })

  it('applyFilters combines multiple filters', () => {
    const { updateFilter, applyFilters } = useViewFilters()
    updateFilter('jobName', 'alpha')
    updateFilter('priority', 'high')

    const items = [
      { name: 'Alpha Job', priority: 'High', id: '1' },
      { name: 'Alpha Low', priority: 'Low', id: '2' },
      { name: 'Beta Job', priority: 'High', id: '3' },
    ]

    const result = applyFilters(items, {
      jobName: i => i.name,
      priority: i => i.priority,
    })
    expect(result.map(i => i.id)).toEqual(['1'])
  })

  it('applyFilters ignores filters without matching accessors', () => {
    const { updateFilter, applyFilters } = useViewFilters()
    updateFilter('priority', 'High')

    const items = [{ id: '1' }, { id: '2' }]
    // No priority accessor provided — filter should be ignored
    const result = applyFilters(items, {})
    expect(result).toHaveLength(2)
  })
})

/**
 * Tag filtering tests for useViewFilters
 * Validates: Requirements 13.3, 13.5, 13.6
 */
describe('useViewFilters – tag filtering', () => {
  beforeEach(() => {
    localStorageMock.clear()
    const { clearFilters } = useViewFilters()
    clearFilters()
  })

  it('filters by a single tagId (only items with that tag pass)', () => {
    const { updateFilter, applyFilters } = useViewFilters()
    updateFilter('tagIds', ['tag_a'])

    const items = [
      { id: '1', tags: ['tag_a', 'tag_b'] },
      { id: '2', tags: ['tag_b'] },
      { id: '3', tags: ['tag_a'] },
    ]

    const result = applyFilters(items, { tagIds: i => i.tags })
    expect(result.map(i => i.id)).toEqual(['1', '3'])
  })

  it('filters by multiple tagIds with AND logic (item must have ALL selected tags)', () => {
    const { updateFilter, applyFilters } = useViewFilters()
    updateFilter('tagIds', ['tag_a', 'tag_b'])

    const items = [
      { id: '1', tags: ['tag_a', 'tag_b', 'tag_c'] },
      { id: '2', tags: ['tag_a'] },
      { id: '3', tags: ['tag_b'] },
      { id: '4', tags: ['tag_a', 'tag_b'] },
    ]

    const result = applyFilters(items, { tagIds: i => i.tags })
    expect(result.map(i => i.id)).toEqual(['1', '4'])
  })

  it('does not filter when tagIds is empty', () => {
    const { updateFilter, applyFilters } = useViewFilters()
    updateFilter('tagIds', [])

    const items = [
      { id: '1', tags: ['tag_a'] },
      { id: '2', tags: [] },
      { id: '3', tags: ['tag_b'] },
    ]

    const result = applyFilters(items, { tagIds: i => i.tags })
    expect(result).toHaveLength(3)
  })

  it('excludes items with no tags when tag filter is active', () => {
    const { updateFilter, applyFilters } = useViewFilters()
    updateFilter('tagIds', ['tag_a'])

    const items = [
      { id: '1', tags: ['tag_a'] },
      { id: '2', tags: [] },
      { id: '3', tags: ['tag_a', 'tag_b'] },
    ]

    const result = applyFilters(items, { tagIds: i => i.tags })
    expect(result.map(i => i.id)).toEqual(['1', '3'])
  })

  it('clearFilters resets tagIds to empty array and groupByTag to false', () => {
    const { filters, updateFilter, clearFilters } = useViewFilters()
    updateFilter('tagIds', ['tag_a', 'tag_b'])
    updateFilter('groupByTag', true)

    expect(filters.value.tagIds).toEqual(['tag_a', 'tag_b'])
    expect(filters.value.groupByTag).toBe(true)

    clearFilters()

    expect(filters.value.tagIds).toEqual([])
    expect(filters.value.groupByTag).toBe(false)
  })

  it('tag filter combines with jobName filter (AND across filter types)', () => {
    const { updateFilter, applyFilters } = useViewFilters()
    updateFilter('tagIds', ['tag_a'])
    updateFilter('jobName', 'alpha')

    const items = [
      { id: '1', name: 'Alpha Job', tags: ['tag_a'] },
      { id: '2', name: 'Beta Job', tags: ['tag_a'] },
      { id: '3', name: 'Alpha Other', tags: ['tag_b'] },
      { id: '4', name: 'Alpha Both', tags: ['tag_a', 'tag_b'] },
    ]

    const result = applyFilters(items, {
      jobName: i => i.name,
      tagIds: i => i.tags,
    })
    // Must match BOTH jobName "alpha" AND have tag_a
    expect(result.map(i => i.id)).toEqual(['1', '4'])
  })
})
