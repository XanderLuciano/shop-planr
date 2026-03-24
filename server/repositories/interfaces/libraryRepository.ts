import type { ProcessLibraryEntry, LocationLibraryEntry } from '../../types/domain'

export interface LibraryRepository {
  listProcesses(): ProcessLibraryEntry[]
  createProcess(entry: ProcessLibraryEntry): ProcessLibraryEntry
  deleteProcess(id: string): boolean
  listLocations(): LocationLibraryEntry[]
  createLocation(entry: LocationLibraryEntry): LocationLibraryEntry
  deleteLocation(id: string): boolean
}
