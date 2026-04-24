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
    const { bomService, jobService } = ctx

    // Create jobs to reference in BOM entries
    const bracketJob = jobService.createJob({ name: 'Bracket', goalQuantity: 10 })
    const boltJob = jobService.createJob({ name: 'Bolt', goalQuantity: 20 })
    const washerJob = jobService.createJob({ name: 'Washer', goalQuantity: 30 })

    // 1. Create a BOM with initial entries
    const bom = bomService.createBom({
      name: 'Assembly BOM',
      entries: [
        { jobId: bracketJob.id, requiredQuantity: 4 },
        { jobId: boltJob.id, requiredQuantity: 12 },
      ],
    })
    expect(bom.entries).toHaveLength(2)

    // 2. First edit — change quantities, add washer
    const edited1 = bomService.editBom(bom.id, {
      entries: [
        { jobId: bracketJob.id, requiredQuantity: 6 },
        { jobId: boltJob.id, requiredQuantity: 16 },
        { jobId: washerJob.id, requiredQuantity: 16 },
      ],
      changeDescription: 'Increased quantities, added washers',
      userId: 'engineer1',
    })
    expect(edited1.entries).toHaveLength(3)

    // 3. Second edit — remove bolt
    const edited2 = bomService.editBom(bom.id, {
      entries: [
        { jobId: bracketJob.id, requiredQuantity: 6 },
        { jobId: washerJob.id, requiredQuantity: 20 },
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
    expect(v1!.entriesSnapshot[0].jobId).toBe(bracketJob.id)
    expect(v1!.entriesSnapshot[0].requiredQuantity).toBe(4)
    expect(v1!.entriesSnapshot[1].jobId).toBe(boltJob.id)
    expect(v1!.entriesSnapshot[1].requiredQuantity).toBe(12)
    expect(v1!.changeDescription).toBe('Increased quantities, added washers')
    expect(v1!.changedBy).toBe('engineer1')

    // 6. Verify version 2 contains the entries after first edit (snapshot before second edit)
    const v2 = versions.find(v => v.versionNumber === 2)
    expect(v2).toBeDefined()
    expect(v2!.entriesSnapshot).toHaveLength(3)
    expect(v2!.entriesSnapshot[0].jobId).toBe(bracketJob.id)
    expect(v2!.entriesSnapshot[0].requiredQuantity).toBe(6)
    expect(v2!.entriesSnapshot[2].jobId).toBe(washerJob.id)
    expect(v2!.changeDescription).toBe('Removed bolts, increased washers')

    // 7. Verify version 1 is unchanged after edit 2 (immutability)
    const versionsAfter = bomService.listBomVersions(bom.id)
    const v1After = versionsAfter.find(v => v.versionNumber === 1)
    expect(v1After!.entriesSnapshot).toHaveLength(2)
    expect(v1After!.entriesSnapshot[0].requiredQuantity).toBe(4)
    expect(v1After!.entriesSnapshot[1].requiredQuantity).toBe(12)
  })

  it('edit BOM records audit entry', () => {
    ctx = createTestContext()
    const { bomService, jobService, auditService } = ctx

    const job = jobService.createJob({ name: 'Part A', goalQuantity: 10 })

    const bom = bomService.createBom({
      name: 'Audit BOM',
      entries: [{ jobId: job.id }],
    })

    bomService.editBom(bom.id, {
      entries: [{ jobId: job.id, requiredQuantity: 2 }],
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
