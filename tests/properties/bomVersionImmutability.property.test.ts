/**
 * Property 9: BOM Version Immutability
 *
 * For any BOM, verify editing creates a new version without modifying
 * previous versions. Reading version N after any number of subsequent
 * edits shall return the same entries as the initial read of version N.
 *
 * **Validates: Requirements 10.2, 10.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createBomService } from '../../server/services/bomService'
import { createAuditService } from '../../server/services/auditService'
import type { BOM, BomEntry, BomVersion, AuditEntry } from '../../server/types/domain'

/**
 * In-memory BOM repository for pure property testing.
 */
function createInMemoryBomRepo() {
  const boms = new Map<string, BOM>()
  return {
    create: (bom: BOM) => {
      boms.set(bom.id, { ...bom })
      return bom
    },
    getById: (id: string) => {
      const b = boms.get(id)
      return b ? { ...b, entries: b.entries.map((e) => ({ ...e })) } : null
    },
    list: () => [...boms.values()],
    update: (id: string, partial: Partial<BOM>) => {
      const existing = boms.get(id)!
      const updated = { ...existing, ...partial }
      boms.set(id, updated)
      return { ...updated }
    },
    delete: () => true,
  }
}

function createInMemoryBomVersionRepo() {
  const versions: BomVersion[] = []
  return {
    create: (v: BomVersion) => {
      versions.push({ ...v, entriesSnapshot: v.entriesSnapshot.map((e) => ({ ...e })) })
      return v
    },
    listByBomId: (bomId: string) =>
      versions
        .filter((v) => v.bomId === bomId)
        .map((v) => ({ ...v, entriesSnapshot: v.entriesSnapshot.map((e) => ({ ...e })) })),
    getLatestByBomId: (bomId: string) => {
      const bomVersions = versions.filter((v) => v.bomId === bomId)
      if (bomVersions.length === 0) return null
      return bomVersions.reduce((a, b) => (a.versionNumber > b.versionNumber ? a : b))
    },
    getAll: () =>
      versions.map((v) => ({ ...v, entriesSnapshot: v.entriesSnapshot.map((e) => ({ ...e })) })),
  }
}

function createInMemoryAuditRepo() {
  const entries: AuditEntry[] = []
  return {
    create: (entry: AuditEntry) => {
      entries.push(entry)
      return entry
    },
    list: () => [...entries],
    listByPartId: () => [],
    listByJobId: () => [],
  }
}

function createInMemoryPartRepo() {
  return {
    countByJobId: () => 0,
    countCompletedByJobId: () => 0,
    countScrappedByJobId: () => 0,
  }
}

/** Arbitrary for BOM entry */
const arbBomEntry = fc.record({
  partType: fc.string({ minLength: 1, maxLength: 20 }),
  requiredQuantityPerBuild: fc.integer({ min: 1, max: 100 }),
  contributingJobIds: fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
    minLength: 0,
    maxLength: 3,
  }),
})

/** Arbitrary for a non-empty array of BOM entries */
const arbBomEntries = fc.array(arbBomEntry, { minLength: 1, maxLength: 5 })

describe('Property 9: BOM Version Immutability', () => {
  it('editing a BOM creates a new version snapshot without modifying previous versions', () => {
    fc.assert(
      fc.property(
        arbBomEntries,
        arbBomEntries,
        arbBomEntries,
        (initialEntries, editEntries1, editEntries2) => {
          const bomRepo = createInMemoryBomRepo()
          const bomVersionRepo = createInMemoryBomVersionRepo()
          const auditRepo = createInMemoryAuditRepo()
          const partRepo = createInMemoryPartRepo()
          const auditService = createAuditService({ audit: auditRepo })
          const bomService = createBomService(
            { bom: bomRepo, parts: partRepo as any, bomVersions: bomVersionRepo },
            auditService
          )

          // Create initial BOM
          const bom = bomService.createBom({
            name: 'Test BOM',
            entries: initialEntries,
          })

          // First edit
          bomService.editBom(bom.id, {
            entries: editEntries1,
            changeDescription: 'First edit',
            userId: 'user1',
          })

          // Capture version 1 snapshot
          const versionsAfterEdit1 = bomService.listBomVersions(bom.id)
          expect(versionsAfterEdit1).toHaveLength(1)
          const version1Snapshot = versionsAfterEdit1[0]!.entriesSnapshot.map((e) => ({
            partType: e.partType,
            requiredQuantityPerBuild: e.requiredQuantityPerBuild,
          }))

          // Second edit
          bomService.editBom(bom.id, {
            entries: editEntries2,
            changeDescription: 'Second edit',
            userId: 'user2',
          })

          // Verify version 1 is unchanged after second edit
          const versionsAfterEdit2 = bomService.listBomVersions(bom.id)
          expect(versionsAfterEdit2).toHaveLength(2)

          const version1AfterEdit2 = versionsAfterEdit2.find((v) => v.versionNumber === 1)!
          const version1SnapshotAfter = version1AfterEdit2.entriesSnapshot.map((e) => ({
            partType: e.partType,
            requiredQuantityPerBuild: e.requiredQuantityPerBuild,
          }))

          expect(version1SnapshotAfter).toEqual(version1Snapshot)

          // Verify version numbers are sequential
          expect(versionsAfterEdit2[0]!.versionNumber).toBe(1)
          expect(versionsAfterEdit2[1]!.versionNumber).toBe(2)
        }
      ),
      { numRuns: 100 }
    )
  })
})
