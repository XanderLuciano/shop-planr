/**
 * Property 17: Library Entry Round-Trip
 *
 * For any process name or location name added to the respective library,
 * listing the library shall include that entry. Removing an entry shall cause
 * it to no longer appear in the list. Existing Process Steps referencing a
 * removed library entry shall retain their current name values unchanged.
 *
 * **Validates: Requirements 16.1, 16.2, 16.5, 16.7**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createLibraryService } from '../../server/services/libraryService'
import type { ProcessLibraryEntry, LocationLibraryEntry } from '../../server/types/domain'

/**
 * In-memory library repository for pure property testing.
 */
function createInMemoryLibraryRepo() {
  const processes: ProcessLibraryEntry[] = []
  const locations: LocationLibraryEntry[] = []

  return {
    listProcesses: () => [...processes],
    createProcess: (entry: ProcessLibraryEntry) => {
      processes.push(entry)
      return entry
    },
    deleteProcess: (id: string) => {
      const idx = processes.findIndex(p => p.id === id)
      if (idx >= 0) {
        processes.splice(idx, 1)
        return true
      }
      return false
    },
    listLocations: () => [...locations],
    createLocation: (entry: LocationLibraryEntry) => {
      locations.push(entry)
      return entry
    },
    deleteLocation: (id: string) => {
      const idx = locations.findIndex(l => l.id === id)
      if (idx >= 0) {
        locations.splice(idx, 1)
        return true
      }
      return false
    },
  }
}

/** Arbitrary for non-empty trimmed strings (valid library names) */
const arbName = fc.string({ minLength: 1, maxLength: 50 })
  .map(s => s.trim())
  .filter(s => s.length > 0)

describe('Property 17: Library Entry Round-Trip', () => {
  it('any process name added appears in list; after removal it is gone', () => {
    fc.assert(
      fc.property(arbName, (name) => {
        const repo = createInMemoryLibraryRepo()
        const service = createLibraryService({ library: repo })

        // Add
        const entry = service.addProcess(name)
        const listAfterAdd = service.listProcesses()
        expect(listAfterAdd.some(e => e.id === entry.id && e.name === name.trim())).toBe(true)

        // Remove
        service.removeProcess(entry.id)
        const listAfterRemove = service.listProcesses()
        expect(listAfterRemove.some(e => e.id === entry.id)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('any location name added appears in list; after removal it is gone', () => {
    fc.assert(
      fc.property(arbName, (name) => {
        const repo = createInMemoryLibraryRepo()
        const service = createLibraryService({ library: repo })

        // Add
        const entry = service.addLocation(name)
        const listAfterAdd = service.listLocations()
        expect(listAfterAdd.some(e => e.id === entry.id && e.name === name.trim())).toBe(true)

        // Remove
        service.removeLocation(entry.id)
        const listAfterRemove = service.listLocations()
        expect(listAfterRemove.some(e => e.id === entry.id)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('duplicate process names are rejected', () => {
    fc.assert(
      fc.property(arbName, (name) => {
        const repo = createInMemoryLibraryRepo()
        const service = createLibraryService({ library: repo })

        service.addProcess(name)
        expect(() => service.addProcess(name)).toThrow('Process name already exists')
      }),
      { numRuns: 100 },
    )
  })

  it('duplicate location names are rejected', () => {
    fc.assert(
      fc.property(arbName, (name) => {
        const repo = createInMemoryLibraryRepo()
        const service = createLibraryService({ library: repo })

        service.addLocation(name)
        expect(() => service.addLocation(name)).toThrow('Location name already exists')
      }),
      { numRuns: 100 },
    )
  })
})
