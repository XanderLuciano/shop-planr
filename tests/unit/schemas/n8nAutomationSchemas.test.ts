/**
 * Unit tests for n8n automation Zod schemas.
 *
 * Covers: createN8nAutomationSchema and updateN8nAutomationSchema
 * validation rules — required fields, type constraints, defaults.
 */
import { describe, it, expect } from 'vitest'
import {
  createN8nAutomationSchema,
  updateN8nAutomationSchema,
} from '~/server/schemas/n8nAutomationSchemas'

describe('createN8nAutomationSchema', () => {
  const validInput = {
    name: 'Test Automation',
    eventTypes: ['part_advanced'],
    workflowJson: {
      nodes: [
        {
          id: 'node-1',
          name: 'HTTP Request',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4,
          position: [200, 200],
          parameters: { method: 'POST', url: 'https://example.com' },
        },
      ],
      connections: {},
    },
  }

  it('accepts valid minimal input', () => {
    const result = createN8nAutomationSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('defaults description to empty string', () => {
    const result = createN8nAutomationSchema.parse(validInput)
    expect(result.description).toBe('')
  })

  it('defaults enabled to false', () => {
    const result = createN8nAutomationSchema.parse(validInput)
    expect(result.enabled).toBe(false)
  })

  it('accepts full input with all fields', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      description: 'A test automation',
      enabled: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('A test automation')
      expect(result.data.enabled).toBe(true)
    }
  })

  it('rejects empty name', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 100 chars', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      name: 'x'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty eventTypes array', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      eventTypes: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid event type', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      eventTypes: ['invalid_event_type'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing workflowJson', () => {
    const { workflowJson: _, ...noWorkflow } = validInput
    const result = createN8nAutomationSchema.safeParse(noWorkflow)
    expect(result.success).toBe(false)
  })

  it('rejects workflowJson without nodes array', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      workflowJson: { connections: {} },
    })
    expect(result.success).toBe(false)
  })

  it('rejects workflowJson without connections', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      workflowJson: { nodes: [] },
    })
    expect(result.success).toBe(false)
  })

  it('accepts workflowJson with empty nodes array', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      workflowJson: { nodes: [], connections: {} },
    })
    expect(result.success).toBe(true)
  })

  it('rejects node with missing id', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      workflowJson: {
        nodes: [{ name: 'X', type: 'y', typeVersion: 1, position: [0, 0], parameters: {} }],
        connections: {},
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects node with invalid position (not a tuple)', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      workflowJson: {
        nodes: [{ id: 'n1', name: 'X', type: 'y', typeVersion: 1, position: [0], parameters: {} }],
        connections: {},
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects node with typeVersion < 1', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      workflowJson: {
        nodes: [{ id: 'n1', name: 'X', type: 'y', typeVersion: 0, position: [0, 0], parameters: {} }],
        connections: {},
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects description longer than 500 chars', () => {
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      description: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid webhook event types', () => {
    const allTypes = [
      'part_advanced', 'part_completed', 'part_created', 'part_scrapped',
      'part_force_completed', 'part_deleted', 'step_skipped', 'step_deferred',
      'step_waived', 'deferred_step_completed', 'step_override_created',
      'step_override_reversed', 'job_created', 'job_deleted', 'path_deleted',
      'note_created', 'cert_attached',
    ]
    const result = createN8nAutomationSchema.safeParse({
      ...validInput,
      eventTypes: allTypes,
    })
    expect(result.success).toBe(true)
  })
})

describe('updateN8nAutomationSchema', () => {
  it('accepts empty object (no updates)', () => {
    const result = updateN8nAutomationSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial name update', () => {
    const result = updateN8nAutomationSchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('accepts partial enabled update', () => {
    const result = updateN8nAutomationSchema.safeParse({ enabled: true })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = updateN8nAutomationSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty eventTypes array', () => {
    const result = updateN8nAutomationSchema.safeParse({ eventTypes: [] })
    expect(result.success).toBe(false)
  })

  it('rejects invalid event type in update', () => {
    const result = updateN8nAutomationSchema.safeParse({
      eventTypes: ['not_a_real_event'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid workflowJson update', () => {
    const result = updateN8nAutomationSchema.safeParse({
      workflowJson: {
        nodes: [],
        connections: {},
        settings: { executionOrder: 'v1' },
      },
    })
    expect(result.success).toBe(true)
  })
})
