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
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) })
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
    expect(filters.value).toEqual({ status: 'all' })
  })

  it('applyFilters filters by jobName (case-insensitive)', () => {
    const { updateFilter, applyFilters } = useViewFilters()
    updateFilter('jobName', 'alpha')

    const items = [
      { name: 'Alpha Job', id: '1' },
      { name: 'Beta Job', id: '2' },
      { name: 'ALPHA-2', id: '3' }
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
      { id: '3', done: true }
    ]

    const result = applyFilters(items, {
      status: i => i.done ? 'completed' : 'active'
    })
    expect(result.map(i => i.id)).toEqual(['1', '3'])
  })

  it('applyFilters with status "all" returns everything', () => {
    const { filters, applyFilters } = useViewFilters()
    expect(filters.value.status).toBe('all')

    const items = [
      { id: '1', done: true },
      { id: '2', done: false }
    ]

    const result = applyFilters(items, {
      status: i => i.done ? 'completed' : 'active'
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
      { name: 'Beta Job', priority: 'High', id: '3' }
    ]

    const result = applyFilters(items, {
      jobName: i => i.name,
      priority: i => i.priority
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
