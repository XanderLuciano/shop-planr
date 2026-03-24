/**
 * Integration: BOM Version History
 *
 * Create BOM → edit twice → verify 2 versions exist →
 * verify version 1 unchanged after edit 2.
 * Validates: Requirements 10.1, 10.2, 10.3
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('BOM Version History Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('full BOM version flow: create → edit twice → verify versions → verify immutability', () => {
    ctx = createTestContext()
    const { bomService } = ctx

    // 1. Create a BOM with initial entries
    const bom = bomService.createBom({
      name: 'Assembly BOM',
      entries: [
        { partType: 'Bracket', requiredQuantityPerBuild: 4, contributingJobIds: [] },
        { partType: 'Bolt', requiredQuantityPerBuild: 12, contributingJobIds: [] },
      ],
    })
    expect(bom.entries).toHaveLength(2)

    // 2. First edit — change quantities
    const edited1 = bomService.editBom(bom.id, {
      entries: [
        { partType: 'Bracket', requiredQuantityPerBuild: 6, contributingJobIds: [] },
        { partType: 'Bolt', requiredQuantityPerBuild: 16, contributingJobIds: [] },
        { partType: 'Washer', requiredQuantityPerBuild: 16, contributingJobIds: [] },
      ],
      changeDescription: 'Increased quantities, added washers',
      userId: 'engineer1',
    })
    expect(edited1.entries).toHaveLength(3)

    // 3. Second edit — remove a part
    const edited2 = bomService.editBom(bom.id, {
      entries: [
        { partType: 'Bracket', requiredQuantityPerBuild: 6, contributingJobIds: [] },
        { partType: 'Washer', requiredQuantityPerBuild: 20, contributingJobIds: [] },
      ],
      changeDescription: 'Removed bolts, increased washers',
      userId: 'engineer2',
    })
    expect(edited2.entries).toHaveLength(2)

    // 4. Verify 2 versions exist
    const versions = bomService.listBomVersions(bom.id)
    expect(versions).toHaveLength(2)

    // 5. Verify version 1 contains the original entries (snapshot before first edit)
    const v1 = versions.find(v => v.versionNumber === 1)
    expect(v1).toBeDefined()
    expect(v1!.entriesSnapshot).toHaveLength(2)
    expect(v1!.entriesSnapshot[0].partType).toBe('Bracket')
    expect(v1!.entriesSnapshot[0].requiredQuantityPerBuild).toBe(4)
    expect(v1!.entriesSnapshot[1].partType).toBe('Bolt')
    expect(v1!.entriesSnapshot[1].requiredQuantityPerBuild).toBe(12)
    expect(v1!.changeDescription).toBe('Increased quantities, added washers')
    expect(v1!.changedBy).toBe('engineer1')

    // 6. Verify version 2 contains the entries after first edit (snapshot before second edit)
    const v2 = versions.find(v => v.versionNumber === 2)
    expect(v2).toBeDefined()
    expect(v2!.entriesSnapshot).toHaveLength(3)
    expect(v2!.entriesSnapshot[0].partType).toBe('Bracket')
    expect(v2!.entriesSnapshot[0].requiredQuantityPerBuild).toBe(6)
    expect(v2!.entriesSnapshot[2].partType).toBe('Washer')
    expect(v2!.changeDescription).toBe('Removed bolts, increased washers')

    // 7. Verify version 1 is unchanged after edit 2 (immutability)
    const versionsAfter = bomService.listBomVersions(bom.id)
    const v1After = versionsAfter.find(v => v.versionNumber === 1)
    expect(v1After!.entriesSnapshot).toHaveLength(2)
    expect(v1After!.entriesSnapshot[0].requiredQuantityPerBuild).toBe(4)
    expect(v1After!.entriesSnapshot[1].requiredQuantityPerBuild).toBe(12)
  })

  it('edit BOM records audit entry', () => {
    ctx = createTestContext()
    const { bomService, auditService } = ctx

    const bom = bomService.createBom({
      name: 'Audit BOM',
      entries: [{ partType: 'Part A', requiredQuantityPerBuild: 1, contributingJobIds: [] }],
    })

    bomService.editBom(bom.id, {
      entries: [{ partType: 'Part A', requiredQuantityPerBuild: 2, contributingJobIds: [] }],
      changeDescription: 'Doubled quantity',
      userId: 'user1',
    })

    const entries = auditService.listAuditEntries()
    const bomEditEntry = entries.find(e => e.action === 'bom_edited')
    expect(bomEditEntry).toBeDefined()
    expect(bomEditEntry!.metadata).toMatchObject({
      bomId: bom.id,
      changeDescription: 'Doubled quantity',
      versionNumber: 1,
    })
  })
})
