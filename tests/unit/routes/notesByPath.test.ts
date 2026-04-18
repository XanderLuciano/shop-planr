/**
 * Unit tests for noteService.getNotesForPath() and GET /api/notes/path/:pathId route.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '~/server/utils/errors'
import { createNoteService } from '~/server/services/noteService'
import type { StepNote } from '~/server/types/domain'

// ── Service Tests ──

describe('noteService.getNotesForPath()', () => {
  /**
   * Validates: Requirement 3.1, 3.2
   * Service delegates to repository and returns notes sorted by createdAt desc.
   */
  it('returns notes from the repository sorted by createdAt desc', () => {
    const notes: StepNote[] = [
      makeNote('note_3', '2024-01-03T00:00:00Z'),
      makeNote('note_1', '2024-01-01T00:00:00Z'),
      makeNote('note_2', '2024-01-02T00:00:00Z'),
    ]
    // Repository returns them already sorted desc (as the SQL query does)
    const sortedNotes = [...notes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

    const mockRepo = { listByPathId: vi.fn().mockReturnValue(sortedNotes) }
    const mockAuditService = {} as any

    const service = createNoteService({ notes: mockRepo } as any, mockAuditService)

    const result = service.getNotesForPath('path_1')

    expect(mockRepo.listByPathId).toHaveBeenCalledWith('path_1')
    expect(result).toHaveLength(3)
    // Verify descending order
    expect(result[0].id).toBe('note_3')
    expect(result[1].id).toBe('note_2')
    expect(result[2].id).toBe('note_1')
  })

  /**
   * Validates: Requirement 3.4
   * Service returns empty array when no notes exist for the path.
   */
  it('returns empty array when repository has no notes for the path', () => {
    const mockRepo = { listByPathId: vi.fn().mockReturnValue([]) }
    const mockAuditService = {} as any

    const service = createNoteService({ notes: mockRepo } as any, mockAuditService)

    const result = service.getNotesForPath('path_empty')

    expect(mockRepo.listByPathId).toHaveBeenCalledWith('path_empty')
    expect(result).toEqual([])
  })
})

// ── Route Tests ──

// Stub Nitro auto-imports before importing the route handler
vi.stubGlobal('ValidationError', ValidationError)
vi.stubGlobal('NotFoundError', NotFoundError)
vi.stubGlobal('ForbiddenError', ForbiddenError)
vi.stubGlobal('AuthenticationError', AuthenticationError)
vi.stubGlobal('createError', (await import('h3')).createError)

const mockNoteService = {
  getNotesForPath: vi.fn(),
}

const mockPathService = {
  getPath: vi.fn(),
}

vi.stubGlobal('getServices', () => ({
  noteService: mockNoteService,
  pathService: mockPathService,
}))

vi.stubGlobal('getRouterParam', vi.fn())
vi.stubGlobal('defineApiHandler', (fn: unknown) => fn)

const handler = (await import('~/server/api/notes/path/[id].get')).default

function makeFakeEvent() {
  return {
    node: { req: {}, res: {} },
  } as unknown as Parameters<typeof handler>[0]
}

describe('GET /api/notes/path/:pathId route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Validates: Requirement 3.1, 3.2
   * Route returns notes sorted by createdAt desc for a valid path.
   */
  it('returns notes sorted by createdAt desc for a valid path', async () => {
    const notes: StepNote[] = [
      makeNote('note_c', '2024-03-01T00:00:00Z'),
      makeNote('note_b', '2024-02-01T00:00:00Z'),
      makeNote('note_a', '2024-01-01T00:00:00Z'),
    ]

    vi.mocked(globalThis.getRouterParam as any).mockReturnValue('path_1')
    mockPathService.getPath.mockReturnValue({ id: 'path_1' })
    mockNoteService.getNotesForPath.mockReturnValue(notes)

    const result = await handler(makeFakeEvent())

    expect(mockPathService.getPath).toHaveBeenCalledWith('path_1')
    expect(mockNoteService.getNotesForPath).toHaveBeenCalledWith('path_1')
    expect(result).toEqual(notes)
    expect(result[0].createdAt > result[1].createdAt).toBe(true)
    expect(result[1].createdAt > result[2].createdAt).toBe(true)
  })

  /**
   * Validates: Requirement 3.3
   * Route returns 404 when the path does not exist.
   */
  it('throws NotFoundError for a non-existent path', async () => {
    vi.mocked(globalThis.getRouterParam as any).mockReturnValue('path_missing')
    mockPathService.getPath.mockImplementation(() => {
      throw new NotFoundError('Path', 'path_missing')
    })

    await expect(handler(makeFakeEvent())).rejects.toThrow(NotFoundError)
    expect(mockNoteService.getNotesForPath).not.toHaveBeenCalled()
  })

  /**
   * Validates: Requirement 3.4
   * Route returns empty array (200) for a path with no notes.
   */
  it('returns empty array for a path with no notes', async () => {
    vi.mocked(globalThis.getRouterParam as any).mockReturnValue('path_empty')
    mockPathService.getPath.mockReturnValue({ id: 'path_empty' })
    mockNoteService.getNotesForPath.mockReturnValue([])

    const result = await handler(makeFakeEvent())

    expect(result).toEqual([])
  })

  /**
   * Validates: Requirement 3.1
   * Route extracts pathId from the route param and passes it through.
   */
  it('extracts pathId from route param and calls services correctly', async () => {
    vi.mocked(globalThis.getRouterParam as any).mockReturnValue('path_xyz')
    mockPathService.getPath.mockReturnValue({ id: 'path_xyz' })
    mockNoteService.getNotesForPath.mockReturnValue([])

    await handler(makeFakeEvent())

    expect(globalThis.getRouterParam).toHaveBeenCalledWith(expect.anything(), 'id')
    expect(mockPathService.getPath).toHaveBeenCalledWith('path_xyz')
    expect(mockNoteService.getNotesForPath).toHaveBeenCalledWith('path_xyz')
  })
})

// ── Helpers ──

function makeNote(id: string, createdAt: string): StepNote {
  return {
    id,
    jobId: 'job_1',
    pathId: 'path_1',
    stepId: 'step_1',
    partIds: ['part_1'],
    text: `Note ${id}`,
    createdBy: 'user_1',
    createdAt,
    pushedToJira: false,
  }
}
