import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPathService } from '~/server/services/pathService'
import { NotFoundError } from '~/server/utils/errors'
import type { PathRepository } from '~/server/repositories/interfaces/pathRepository'
import type { PartRepository } from '~/server/repositories/interfaces/partRepository'
import type { ProcessStep } from '~/server/types/domain'

/**
 * Validates: Requirements 5.1, 5.2
 *
 * Tests that pathService.updateStep merges the `location` field correctly:
 * - When location is provided, it gets merged into the step
 * - When location is omitted, the existing location is preserved
 */

function makeStep(overrides: Partial<ProcessStep> = {}): ProcessStep {
  return {
    id: 'step_1',
    name: 'Machining',
    order: 0,
    location: 'Bay 1',
    optional: false,
    dependencyType: 'preferred',
    completedCount: 0,
    ...overrides,
  }
}

function createMockPathRepo(step: ProcessStep): PathRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    listByJobId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getStepById: vi.fn((id: string) => (id === step.id ? step : null)),
    getStepByIdIncludeRemoved: vi.fn(),
    updateStepAssignment: vi.fn(),
    updateStep: vi.fn((_stepId: string, partial: Partial<ProcessStep>) => ({
      ...step,
      ...partial,
    })),
    softDeleteStep: vi.fn(),
    hasStepDependents: vi.fn(() => false),
  }
}

function createMockPartRepo(): PartRepository {
  return {
    create: vi.fn(),
    createBatch: vi.fn(),
    getById: vi.fn(),
    getByIdentifier: vi.fn(),
    listByPathId: vi.fn(() => []),
    listByJobId: vi.fn(),
    listByCurrentStepId: vi.fn(() => []),
    update: vi.fn(),
    countByJobId: vi.fn(),
    countCompletedByJobId: vi.fn(),
    countScrappedByJobId: vi.fn(() => 0),
    listAll: vi.fn(() => []),
    listAllEnriched: vi.fn(() => []),
    deleteByPathId: vi.fn(() => 0),
  }
}

describe('pathService.updateStep — location handling (config endpoint)', () => {
  const existingStep = makeStep({ id: 'step_100', location: 'Bay 1' })
  let pathRepo: PathRepository
  let service: ReturnType<typeof createPathService>

  beforeEach(() => {
    pathRepo = createMockPathRepo(existingStep)
    service = createPathService({ paths: pathRepo, parts: createMockPartRepo() })
  })

  it('passes location to updateStep when location is provided (Req 5.1)', () => {
    const result = service.updateStep('step_100', { location: 'Bay 3' })

    expect(pathRepo.updateStep).toHaveBeenCalledWith('step_100', { location: 'Bay 3' })
    expect(result.location).toBe('Bay 3')
  })

  it('does not modify existing location when location is not in the partial (Req 5.2)', () => {
    const result = service.updateStep('step_100', { optional: true })

    expect(pathRepo.updateStep).toHaveBeenCalledWith('step_100', { optional: true })
    // The merge preserves existing location since it wasn't in the partial
    expect(result.location).toBe('Bay 1')
  })

  it('accepts empty string to clear location (Req 5.1)', () => {
    const result = service.updateStep('step_100', { location: '' })

    expect(pathRepo.updateStep).toHaveBeenCalledWith('step_100', { location: '' })
    expect(result.location).toBe('')
  })

  it('throws NotFoundError for non-existent step', () => {
    expect(() => service.updateStep('nonexistent', { location: 'Bay 3' }))
      .toThrow(NotFoundError)
  })
})
