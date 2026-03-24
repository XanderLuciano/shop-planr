import type { LibraryRepository } from '../repositories/interfaces/libraryRepository'
import type { ProcessLibraryEntry, LocationLibraryEntry } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty } from '../utils/validation'
import { ValidationError } from '../utils/errors'

export function createLibraryService(repos: { library: LibraryRepository }) {
  return {
    listProcesses(): ProcessLibraryEntry[] {
      return repos.library.listProcesses()
    },

    addProcess(name: string): ProcessLibraryEntry {
      assertNonEmpty(name, 'name')
      const trimmed = name.trim()

      // Check for duplicates
      const existing = repos.library.listProcesses()
      if (existing.some(e => e.name === trimmed)) {
        throw new ValidationError('Process name already exists')
      }

      const entry: ProcessLibraryEntry = {
        id: generateId('plib'),
        name: trimmed,
        createdAt: new Date().toISOString(),
      }

      return repos.library.createProcess(entry)
    },

    removeProcess(id: string): void {
      repos.library.deleteProcess(id)
    },

    listLocations(): LocationLibraryEntry[] {
      return repos.library.listLocations()
    },

    addLocation(name: string): LocationLibraryEntry {
      assertNonEmpty(name, 'name')
      const trimmed = name.trim()

      // Check for duplicates
      const existing = repos.library.listLocations()
      if (existing.some(e => e.name === trimmed)) {
        throw new ValidationError('Location name already exists')
      }

      const entry: LocationLibraryEntry = {
        id: generateId('lloc'),
        name: trimmed,
        createdAt: new Date().toISOString(),
      }

      return repos.library.createLocation(entry)
    },

    removeLocation(id: string): void {
      repos.library.deleteLocation(id)
    },
  }
}

export type LibraryService = ReturnType<typeof createLibraryService>
