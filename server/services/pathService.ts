import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { PartRepository } from '../repositories/interfaces/partRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { Path, ProcessStep } from '../types/domain'
import type { StepInput } from '../types/domain'
import type { CreatePathInput, UpdatePathInput } from '../types/api'
import type { StepDistribution } from '../types/computed'

// Re-export StepInput for backward compatibility with existing tests
export type { StepInput } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty, assertNonEmptyArray, assertPositive } from '../utils/validation'
import { NotFoundError, ValidationError } from '../utils/errors'

/** Result of reconciling existing steps with incoming step inputs. */
export interface StepReconciliation {
  toUpdate: ProcessStep[]
  toInsert: ProcessStep[]
  toSoftDelete: string[]
}

/**
 * ID-based reconciliation: matches incoming steps to existing steps by ID.
 *
 * - Inputs with `id` → match existing step by ID → toUpdate (preserve completedCount, assignedTo)
 * - Inputs without `id` → generate new ID → toInsert
 * - Existing steps not in input → toSoftDelete
 * - All output steps get order = their position in the input array
 */
export function reconcileSteps(
  existingSteps: readonly ProcessStep[],
  inputSteps: StepInput[],
): StepReconciliation {
  const toUpdate: ProcessStep[] = []
  const toInsert: ProcessStep[] = []

  const existingById = new Map(existingSteps.map(s => [s.id, s]))

  for (let i = 0; i < inputSteps.length; i++) {
    const input = inputSteps[i]!
    if (input.id) {
      if (existingById.has(input.id)) {
        // Match by ID → toUpdate (preserve existing fields like assignedTo, completedCount)
        const existing = existingById.get(input.id)!
        toUpdate.push({
          id: existing.id,
          name: input.name,
          order: i,
          location: input.location,
          assignedTo: existing.assignedTo,
          optional: input.optional ?? false,
          dependencyType: input.dependencyType ?? 'preferred',
          completedCount: existing.completedCount,
        })
        existingById.delete(input.id)
      } else {
        // Input has an ID but it doesn't match any existing step — reject
        throw new ValidationError(`Step ID "${input.id}" does not match any existing step in this path`)
      }
    } else {
      // New step (no ID) → toInsert
      toInsert.push({
        id: generateId('step'),
        name: input.name,
        order: i,
        location: input.location,
        optional: input.optional ?? false,
        dependencyType: input.dependencyType ?? 'preferred',
        completedCount: 0,
      })
    }
  }

  // Remaining in existingById → toSoftDelete
  const toSoftDelete = [...existingById.keys()]

  return { toUpdate, toInsert, toSoftDelete }
}

export function createPathService(repos: {
  paths: PathRepository
  parts: PartRepository
  users?: UserRepository
}) {
  return {
    createPath(input: CreatePathInput): Path {
      assertNonEmpty(input.name, 'name')
      assertPositive(input.goalQuantity, 'goalQuantity')
      assertNonEmptyArray(input.steps, 'steps')

      const now = new Date().toISOString()
      const steps: ProcessStep[] = input.steps.map((s, index) => ({
        id: generateId('step'),
        name: s.name,
        order: index,
        location: s.location,
        optional: s.optional ?? false,
        dependencyType: s.dependencyType ?? 'preferred',
        completedCount: 0,
      }))

      return repos.paths.create({
        id: generateId('path'),
        jobId: input.jobId,
        name: input.name.trim(),
        goalQuantity: input.goalQuantity,
        steps,
        advancementMode: input.advancementMode ?? 'strict',
        createdAt: now,
        updatedAt: now
      })
    },

    getPath(id: string): Path {
      const path = repos.paths.getById(id)
      if (!path) {
        throw new NotFoundError('Path', id)
      }
      return path
    },

    listPathsByJob(jobId: string): Path[] {
      return repos.paths.listByJobId(jobId)
    },

    updatePath(id: string, input: UpdatePathInput): Path {
      const existing = repos.paths.getById(id)
      if (!existing) {
        throw new NotFoundError('Path', id)
      }

      if (input.name !== undefined) {
        assertNonEmpty(input.name, 'name')
      }
      if (input.goalQuantity !== undefined) {
        assertPositive(input.goalQuantity, 'goalQuantity')
      }
      if (input.steps !== undefined) {
        assertNonEmptyArray(input.steps, 'steps')
      }

      const partial: Partial<Path> = { updatedAt: new Date().toISOString() }
      if (input.name !== undefined) partial.name = input.name.trim()
      if (input.goalQuantity !== undefined) partial.goalQuantity = input.goalQuantity
      if (input.advancementMode !== undefined) partial.advancementMode = input.advancementMode
      if (input.steps !== undefined) {
        const { toUpdate, toInsert, toSoftDelete } = reconcileSteps(existing.steps, input.steps)

        // Guard: check if any active part has currentStepId pointing to a step being removed
        for (const stepId of toSoftDelete) {
          const partsAtStep = repos.parts.listByCurrentStepId(stepId)
          if (partsAtStep.length > 0) {
            throw new ValidationError('Cannot remove step — advance all parts through this step first')
          }
        }

        // Soft-delete removed steps (set removed_at, null out step_order)
        const now = new Date().toISOString()
        for (let i = 0; i < toSoftDelete.length; i++) {
          const stepId = toSoftDelete[i]!
          // Set removed_at and null out step_order so the UNIQUE(path_id, step_order)
          // constraint is satisfied (SQLite treats NULLs as distinct in UNIQUE)
          repos.paths.softDeleteStep(stepId, now)
        }

        // The active steps are the updated + inserted ones, sorted by order
        partial.steps = [...toUpdate, ...toInsert].sort((a, b) => a.order - b.order)
      }

      return repos.paths.update(id, partial)
    },

    deletePath(id: string): boolean {
      const existing = repos.paths.getById(id)
      if (!existing) {
        throw new NotFoundError('Path', id)
      }

      const parts = repos.parts.listByPathId(id)
      if (parts.length > 0) {
        throw new ValidationError('Cannot delete path with parts attached')
      }

      return repos.paths.delete(id)
    },

    getStepDistribution(pathId: string, prefetchedPath?: Path): StepDistribution[] {
      const path = prefetchedPath ?? repos.paths.getById(pathId)
      if (!path) {
        throw new NotFoundError('Path', pathId)
      }

      // Single query: fetch all parts, filter scrapped in-memory
      const allParts = repos.parts.listByPathId(pathId)
        .filter(p => p.status !== 'scrapped')

      // Build histogram of parts per currentStepId in a single pass
      const stepCounts = new Map<string, number>()
      for (const p of allParts) {
        if (p.currentStepId !== null) {
          stepCounts.set(p.currentStepId, (stepCounts.get(p.currentStepId) ?? 0) + 1)
        }
      }

      const distribution: StepDistribution[] = path.steps.map((step) => ({
        stepId: step.id,
        stepName: step.name,
        stepOrder: step.order,
        location: step.location,
        partCount: stepCounts.get(step.id) ?? 0,
        completedCount: step.completedCount,
        isBottleneck: false
      }))

      // Determine bottleneck: step with highest partCount
      let maxCount = 0
      for (const entry of distribution) {
        if (entry.partCount > maxCount) {
          maxCount = entry.partCount
        }
      }
      if (maxCount > 0) {
        for (const entry of distribution) {
          if (entry.partCount === maxCount) {
            entry.isBottleneck = true
          }
        }
      }

      return distribution
    },

    getPathCompletedCount(pathId: string, prefetchedPath?: Path): number {
      const path = prefetchedPath ?? repos.paths.getById(pathId)
      if (!path) {
        throw new NotFoundError('Path', pathId)
      }
      // Count parts where currentStepId IS NULL and status is 'completed'
      const allParts = repos.parts.listByPathId(pathId)
      return allParts.filter(p => p.currentStepId === null && p.status === 'completed').length
    },

    assignStep(stepId: string, userId: string | null): ProcessStep {
      const step = repos.paths.getStepById(stepId)
      if (!step) {
        throw new NotFoundError('ProcessStep', stepId)
      }

      if (userId !== null) {
        if (!repos.users) {
          throw new ValidationError('User repository not available')
        }
        const user = repos.users.getById(userId)
        if (!user || !user.active) {
          throw new ValidationError('User not found or inactive')
        }
      }

      return repos.paths.updateStepAssignment(stepId, userId)
    },

    updateStep(stepId: string, partial: Partial<ProcessStep>): ProcessStep {
      const step = repos.paths.getStepById(stepId)
      if (!step) {
        throw new NotFoundError('ProcessStep', stepId)
      }
      return repos.paths.updateStep(stepId, partial)
    },
  }
}

export type PathService = ReturnType<typeof createPathService>
