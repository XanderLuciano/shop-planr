import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { PartRepository } from '../repositories/interfaces/partRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { Path, ProcessStep } from '../types/domain'
import type { CreatePathInput, UpdatePathInput } from '../types/api'
import type { StepDistribution } from '../types/computed'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty, assertNonEmptyArray, assertPositive } from '../utils/validation'
import { NotFoundError, ValidationError } from '../utils/errors'

/** Input shape for steps provided by the client (no server-side ID). */
export interface StepInput {
  name: string
  location?: string
  optional?: boolean
  dependencyType?: 'physical' | 'preferred' | 'completion_gate'
}

/** Result of reconciling existing steps with incoming step inputs. */
export interface StepReconciliation {
  toUpdate: ProcessStep[]
  toInsert: ProcessStep[]
  toDelete: string[]
}

/**
 * Pure function (except for ID generation) that reconciles existing steps
 * with incoming input steps by position index.
 *
 * - Positions 0..min(N,M)-1: reuse existing step ID → toUpdate
 * - Positions beyond existing count: generate new ID → toInsert
 * - Existing positions beyond input count: collect IDs → toDelete
 * - All output steps get sequential order values 0..N-1
 */
export function reconcileSteps(
  existingSteps: ProcessStep[],
  inputSteps: StepInput[],
): StepReconciliation {
  const toUpdate: ProcessStep[] = []
  const toInsert: ProcessStep[] = []
  const toDelete: string[] = []

  for (let i = 0; i < inputSteps.length; i++) {
    const input = inputSteps[i]
    if (i < existingSteps.length) {
      toUpdate.push({
        id: existingSteps[i].id,
        name: input.name,
        order: i,
        location: input.location,
        assignedTo: existingSteps[i].assignedTo,
        optional: input.optional ?? false,
        dependencyType: input.dependencyType ?? 'preferred',
      })
    } else {
      toInsert.push({
        id: generateId('step'),
        name: input.name,
        order: i,
        location: input.location,
        optional: input.optional ?? false,
        dependencyType: input.dependencyType ?? 'preferred',
      })
    }
  }

  for (let i = inputSteps.length; i < existingSteps.length; i++) {
    toDelete.push(existingSteps[i].id)
  }

  return { toUpdate, toInsert, toDelete }
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
        const { toUpdate, toInsert } = reconcileSteps(existing.steps, input.steps)
        partial.steps = [...toUpdate, ...toInsert]
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

    getStepDistribution(pathId: string): StepDistribution[] {
      const path = repos.paths.getById(pathId)
      if (!path) {
        throw new NotFoundError('Path', pathId)
      }

      const distribution: StepDistribution[] = path.steps.map((step) => {
        const partsAtStep = repos.parts.listByStepIndex(pathId, step.order)
        return {
          stepId: step.id,
          stepName: step.name,
          stepOrder: step.order,
          location: step.location,
          partCount: partsAtStep.length,
          completedCount: 0,
          isBottleneck: false
        }
      })

      // Count completed parts (stepIndex = -1) and distribute to each step's completedCount
      const completedParts = repos.parts.listByStepIndex(pathId, -1)
      const completedCount = completedParts.length
      for (const entry of distribution) {
        entry.completedCount = completedCount
      }

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
