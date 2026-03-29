import type { BomRepository } from '../repositories/interfaces/bomRepository'
import type { BomVersionRepository } from '../repositories/interfaces/bomVersionRepository'
import type { PartRepository } from '../repositories/interfaces/partRepository'
import type { AuditService } from './auditService'
import type { BOM, BomVersion } from '../types/domain'
import type { CreateBomInput, EditBomInput } from '../types/api'
import type { BomSummary, BomEntrySummary } from '../types/computed'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty, assertNonEmptyArray } from '../utils/validation'
import { NotFoundError } from '../utils/errors'

export function createBomService(
  repos: {
    bom: BomRepository
    parts: PartRepository
    bomVersions?: BomVersionRepository
  },
  auditService?: AuditService
) {
  return {
    createBom(input: CreateBomInput): BOM {
      assertNonEmpty(input.name, 'name')
      assertNonEmptyArray(input.entries, 'entries')

      const now = new Date().toISOString()
      return repos.bom.create({
        id: generateId('bom'),
        name: input.name.trim(),
        entries: input.entries.map((e) => ({
          partType: e.partType,
          requiredQuantityPerBuild: e.requiredQuantityPerBuild,
          contributingJobIds: e.contributingJobIds,
        })),
        createdAt: now,
        updatedAt: now,
      })
    },

    getBom(id: string): BOM {
      const bom = repos.bom.getById(id)
      if (!bom) {
        throw new NotFoundError('BOM', id)
      }
      return bom
    },

    listBoms(): BOM[] {
      return repos.bom.list()
    },

    updateBom(id: string, input: Partial<CreateBomInput>): BOM {
      const existing = repos.bom.getById(id)
      if (!existing) {
        throw new NotFoundError('BOM', id)
      }

      if (input.name !== undefined) {
        assertNonEmpty(input.name, 'name')
      }

      const partial: Partial<BOM> = { updatedAt: new Date().toISOString() }
      if (input.name !== undefined) partial.name = input.name.trim()
      if (input.entries !== undefined) {
        partial.entries = input.entries.map((e) => ({
          partType: e.partType,
          requiredQuantityPerBuild: e.requiredQuantityPerBuild,
          contributingJobIds: e.contributingJobIds,
        }))
      }

      return repos.bom.update(id, partial)
    },

    getBomSummary(bomId: string): BomSummary {
      const bom = repos.bom.getById(bomId)
      if (!bom) {
        throw new NotFoundError('BOM', bomId)
      }

      const entries: BomEntrySummary[] = bom.entries.map((entry) => {
        if (entry.contributingJobIds.length === 0) {
          return {
            partType: entry.partType,
            requiredQuantityPerBuild: entry.requiredQuantityPerBuild,
            totalCompleted: 0,
            totalInProgress: 0,
            totalOutstanding: 0,
          }
        }

        let totalCompleted = 0
        let totalInProgress = 0

        for (const jobId of entry.contributingJobIds) {
          const total = repos.parts.countByJobId(jobId)
          const completed = repos.parts.countCompletedByJobId(jobId)
          totalCompleted += completed
          totalInProgress += total - completed
        }

        const totalOutstanding = Math.max(0, entry.requiredQuantityPerBuild - totalCompleted)

        return {
          partType: entry.partType,
          requiredQuantityPerBuild: entry.requiredQuantityPerBuild,
          totalCompleted,
          totalInProgress,
          totalOutstanding,
        }
      })

      return {
        bomId: bom.id,
        bomName: bom.name,
        entries,
      }
    },

    editBom(bomId: string, input: EditBomInput): BOM {
      const existing = repos.bom.getById(bomId)
      if (!existing) {
        throw new NotFoundError('BOM', bomId)
      }

      assertNonEmptyArray(input.entries, 'entries')
      assertNonEmpty(input.changeDescription, 'changeDescription')

      // Determine next version number
      let versionNumber = 1
      if (repos.bomVersions) {
        const latest = repos.bomVersions.getLatestByBomId(bomId)
        if (latest) {
          versionNumber = latest.versionNumber + 1
        }
      }

      // Snapshot current entries into bom_versions
      const now = new Date().toISOString()
      if (repos.bomVersions) {
        const version: BomVersion = {
          id: generateId('bomv'),
          bomId,
          versionNumber,
          entriesSnapshot: [...existing.entries],
          changeDescription: input.changeDescription,
          changedBy: input.userId,
          createdAt: now,
        }
        repos.bomVersions.create(version)
      }

      // Update the BOM entries
      const updated = repos.bom.update(bomId, {
        entries: input.entries.map((e) => ({
          partType: e.partType,
          requiredQuantityPerBuild: e.requiredQuantityPerBuild,
          contributingJobIds: e.contributingJobIds,
        })),
        updatedAt: now,
      })

      // Record audit entry
      if (auditService) {
        auditService.recordBomEdited({
          userId: input.userId,
          metadata: {
            bomId,
            changeDescription: input.changeDescription,
            versionNumber,
          },
        })
      }

      return updated
    },

    listBomVersions(bomId: string): BomVersion[] {
      if (!repos.bomVersions) return []
      return repos.bomVersions.listByBomId(bomId)
    },
  }
}

export type BomService = ReturnType<typeof createBomService>
