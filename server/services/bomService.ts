import type { BomRepository } from '../repositories/interfaces/bomRepository'
import type { BomVersionRepository } from '../repositories/interfaces/bomVersionRepository'
import type { PartRepository } from '../repositories/interfaces/partRepository'
import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { AuditService } from './auditService'
import type { BOM, BomVersion } from '../types/domain'
import type { CreateBomInput, EditBomInput } from '../types/api'
import type { BomSummary, BomEntrySummary } from '../types/computed'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty, assertNonEmptyArray, assertPositive } from '../utils/validation'
import { NotFoundError, ValidationError } from '../utils/errors'

function validateBomEntries(entries: { jobId: string, requiredQuantity?: number }[]) {
  return entries.map((e) => {
    assertNonEmpty(e.jobId, 'entry jobId')
    const qty = e.requiredQuantity ?? 1
    if (!Number.isInteger(qty)) {
      throw new ValidationError('requiredQuantity must be an integer')
    }
    assertPositive(qty, 'requiredQuantity')
    return { jobId: e.jobId, requiredQuantity: qty }
  })
}

export function createBomService(repos: {
  bom: BomRepository
  parts: PartRepository
  jobs: JobRepository
  bomVersions?: BomVersionRepository
}, auditService?: AuditService) {
  return {
    createBom(input: CreateBomInput): BOM {
      assertNonEmpty(input.name, 'name')
      assertNonEmptyArray(input.entries, 'entries')

      const now = new Date().toISOString()
      return repos.bom.create({
        id: generateId('bom'),
        name: input.name.trim(),
        entries: validateBomEntries(input.entries),
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
        partial.entries = validateBomEntries(input.entries)
      }

      return repos.bom.update(id, partial)
    },

    getBomSummary(bomId: string): BomSummary {
      const bom = repos.bom.getById(bomId)
      if (!bom) {
        throw new NotFoundError('BOM', bomId)
      }

      const entries: BomEntrySummary[] = bom.entries.map((entry) => {
        const job = repos.jobs.getById(entry.jobId)
        const jobName = job?.name ?? 'Unknown Job'

        const total = repos.parts.countByJobId(entry.jobId)
        const completed = repos.parts.countCompletedByJobId(entry.jobId)
        const totalInProgress = total - completed
        const totalOutstanding = Math.max(0, entry.requiredQuantity - completed)

        return {
          jobId: entry.jobId,
          jobName,
          requiredQuantity: entry.requiredQuantity,
          totalCompleted: completed,
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

      // Update the BOM entries (and name if provided)
      const updatePayload: Partial<BOM> = {
        entries: validateBomEntries(input.entries),
        updatedAt: now,
      }
      if (input.name !== undefined) {
        assertNonEmpty(input.name, 'name')
        updatePayload.name = input.name.trim()
      }
      const updated = repos.bom.update(bomId, updatePayload)

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
