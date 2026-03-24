/**
 * Integration: Library CRUD
 *
 * Add process → add location → verify in list → remove → verify gone →
 * verify existing steps retain names.
 * Validates: Requirements 16.1, 16.2, 16.6, 16.7
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Library CRUD Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('full library flow: add → list → remove → verify gone → steps retain names', () => {
    ctx = createTestContext()
    const { libraryService, jobService, pathService } = ctx

    // 1. Add process entries
    const cnc = libraryService.addProcess('Custom CNC Op')
    expect(cnc.name).toBe('Custom CNC Op')
    expect(cnc.id).toBeDefined()

    const grinding = libraryService.addProcess('Grinding')
    expect(grinding.name).toBe('Grinding')

    // 2. Add location entries
    const bay1 = libraryService.addLocation('Bay 1')
    expect(bay1.name).toBe('Bay 1')

    const bay2 = libraryService.addLocation('Bay 2')
    expect(bay2.name).toBe('Bay 2')

    // 3. Verify processes in list (includes seed data + new entries)
    const processes = libraryService.listProcesses()
    const processNames = processes.map(p => p.name)
    expect(processNames).toContain('Custom CNC Op')
    expect(processNames).toContain('Grinding')

    // 4. Verify locations in list (includes seed data + new entries)
    const locations = libraryService.listLocations()
    const locationNames = locations.map(l => l.name)
    expect(locationNames).toContain('Bay 1')
    expect(locationNames).toContain('Bay 2')

    // 5. Create a job with steps using library names
    const job = jobService.createJob({ name: 'Library Test Job', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Library Path',
      goalQuantity: 1,
      steps: [
        { name: 'Custom CNC Op', location: 'Bay 1' },
        { name: 'Grinding', location: 'Bay 2' },
      ],
    })
    expect(path.steps[0].name).toBe('Custom CNC Op')
    expect(path.steps[0].location).toBe('Bay 1')

    // 6. Remove the process and location entries
    libraryService.removeProcess(cnc.id)
    libraryService.removeLocation(bay1.id)

    // 7. Verify removed entries are gone from lists
    const processesAfter = libraryService.listProcesses()
    expect(processesAfter.map(p => p.name)).not.toContain('Custom CNC Op')
    expect(processesAfter.map(p => p.name)).toContain('Grinding') // still there

    const locationsAfter = libraryService.listLocations()
    expect(locationsAfter.map(l => l.name)).not.toContain('Bay 1')
    expect(locationsAfter.map(l => l.name)).toContain('Bay 2') // still there

    // 8. Verify existing steps retain their names even after library entry removal
    const refreshedPath = pathService.getPath(path.id)
    expect(refreshedPath.steps[0].name).toBe('Custom CNC Op')
    expect(refreshedPath.steps[0].location).toBe('Bay 1')
    expect(refreshedPath.steps[1].name).toBe('Grinding')
    expect(refreshedPath.steps[1].location).toBe('Bay 2')
  })

  it('duplicate process name is rejected', () => {
    ctx = createTestContext()
    const { libraryService } = ctx

    libraryService.addProcess('Unique Process')
    expect(() => libraryService.addProcess('Unique Process')).toThrow(/already exists/)
  })

  it('duplicate location name is rejected', () => {
    ctx = createTestContext()
    const { libraryService } = ctx

    libraryService.addLocation('Unique Location')
    expect(() => libraryService.addLocation('Unique Location')).toThrow(/already exists/)
  })

  it('seed data is present after migration', () => {
    ctx = createTestContext()
    const { libraryService } = ctx

    // Migration 004 seeds 8 process entries and 3 location entries
    const processes = libraryService.listProcesses()
    expect(processes.length).toBeGreaterThanOrEqual(8)

    const processNames = processes.map(p => p.name)
    expect(processNames).toContain('CNC Machine')
    expect(processNames).toContain('Inspection')
    expect(processNames).toContain('Coating')

    const locations = libraryService.listLocations()
    expect(locations.length).toBeGreaterThanOrEqual(3)

    const locationNames = locations.map(l => l.name)
    expect(locationNames).toContain('Machine Shop')
    expect(locationNames).toContain('QC Lab')
    expect(locationNames).toContain('Vendor')
  })
})
