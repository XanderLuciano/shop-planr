/**
 * Property tests for n8n node definitions utility.
 *
 * - Property 1: Every node definition produces valid default parameters
 * - Property 2: getOutputsForNode always returns at least one output
 * - Property 3: getPaletteGroups covers all non-trigger nodes
 * - Property 4: Node type lookup is consistent
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  NODE_DEFINITIONS,
  getNodeDefinition,
  getOutputsForNode,
  getDefaultParameters,
  getPaletteGroups,
} from '~/app/utils/n8nNodeDefinitions'

// ---- Arbitraries ----

/** Arbitrary that picks a valid node definition from the registry */
const arbNodeDef = fc.constantFrom(...NODE_DEFINITIONS)

/** Arbitrary that picks a valid node type string */
const arbNodeType = fc.constantFrom(...NODE_DEFINITIONS.map(d => d.type))

/** Arbitrary unknown node type (not in registry) */
const arbUnknownType = fc.stringMatching(/^custom-nodes\.[a-z]{3,15}$/)

// ---- Property 1 ----

describe('Property 1: Every node definition produces valid default parameters', () => {
  it('defaultParameters() returns a non-null object for every registered node', () => {
    fc.assert(
      fc.property(arbNodeDef, (def) => {
        const params = def.defaultParameters()
        expect(params).toBeDefined()
        expect(typeof params).toBe('object')
        expect(params).not.toBeNull()
      }),
      { numRuns: NODE_DEFINITIONS.length * 3 },
    )
  })

  it('defaultParameters() is idempotent (returns fresh object each call)', () => {
    fc.assert(
      fc.property(arbNodeDef, (def) => {
        const a = def.defaultParameters()
        const b = def.defaultParameters()
        // Should be equal in value
        expect(a).toEqual(b)
        // But not the same reference (fresh object each time)
        expect(a).not.toBe(b)
      }),
      { numRuns: NODE_DEFINITIONS.length * 2 },
    )
  })
})

// ---- Property 2 ----

describe('Property 2: getOutputsForNode always returns at least one output', () => {
  it('known node types return their declared outputs', () => {
    fc.assert(
      fc.property(arbNodeType, (type) => {
        const outputs = getOutputsForNode(type)
        expect(outputs).toBeDefined()
        expect(outputs!.length).toBeGreaterThanOrEqual(1)

        // Every output has an id
        for (const o of outputs!) {
          expect(o.id).toBeTruthy()
          expect(typeof o.id).toBe('string')
        }
      }),
      { numRuns: NODE_DEFINITIONS.length * 3 },
    )
  })

  it('unknown node types return a single "main" output', () => {
    fc.assert(
      fc.property(arbUnknownType, (type) => {
        const outputs = getOutputsForNode(type)
        expect(outputs).toEqual([{ id: 'main', label: '' }])
      }),
      { numRuns: 50 },
    )
  })
})

// ---- Property 3 ----

describe('Property 3: getPaletteGroups covers all non-trigger nodes', () => {
  it('every non-trigger node appears in exactly one palette group', () => {
    const groups = getPaletteGroups()
    const allPaletteTypes = new Set<string>()

    for (const group of groups) {
      for (const node of group.nodes) {
        // No duplicates across groups
        expect(allPaletteTypes.has(node.type)).toBe(false)
        allPaletteTypes.add(node.type)
      }
    }

    // Every non-trigger node should be in the palette
    const nonTriggerNodes = NODE_DEFINITIONS.filter(d => d.category !== 'trigger')
    for (const def of nonTriggerNodes) {
      expect(allPaletteTypes.has(def.type)).toBe(true)
    }
  })

  it('palette groups have expected category names', () => {
    const groups = getPaletteGroups()
    const names = groups.map(g => g.category)
    expect(names).toContain('Transform')
    expect(names).toContain('Control Flow')
    expect(names).toContain('Destinations')
  })
})

// ---- Property 4 ----

describe('Property 4: Node type lookup is consistent', () => {
  it('getNodeDefinition returns the same object as the registry entry', () => {
    fc.assert(
      fc.property(arbNodeDef, (def) => {
        const found = getNodeDefinition(def.type)
        expect(found).toBe(def)
      }),
      { numRuns: NODE_DEFINITIONS.length * 2 },
    )
  })

  it('getNodeDefinition returns undefined for unknown types', () => {
    fc.assert(
      fc.property(arbUnknownType, (type) => {
        expect(getNodeDefinition(type)).toBeUndefined()
      }),
      { numRuns: 50 },
    )
  })

  it('getDefaultParameters matches the definition factory output', () => {
    fc.assert(
      fc.property(arbNodeType, (type) => {
        const fromHelper = getDefaultParameters(type)
        const def = getNodeDefinition(type)!
        const fromDef = def.defaultParameters()
        expect(fromHelper).toEqual(fromDef)
      }),
      { numRuns: NODE_DEFINITIONS.length * 2 },
    )
  })

  it('getDefaultParameters returns empty object for unknown types', () => {
    fc.assert(
      fc.property(arbUnknownType, (type) => {
        expect(getDefaultParameters(type)).toEqual({})
      }),
      { numRuns: 50 },
    )
  })
})

// ---- Structural invariants ----

describe('Structural invariants', () => {
  it('all node definitions have required fields', () => {
    for (const def of NODE_DEFINITIONS) {
      expect(def.type).toBeTruthy()
      expect(def.label).toBeTruthy()
      expect(def.icon).toBeTruthy()
      expect(def.description).toBeTruthy()
      expect(['trigger', 'transform', 'control', 'destination']).toContain(def.category)
      expect(typeof def.defaultParameters).toBe('function')
    }
  })

  it('IF node has exactly 2 outputs (true/false)', () => {
    const ifDef = getNodeDefinition('n8n-nodes-base.if')
    expect(ifDef).toBeDefined()
    expect(ifDef!.outputs).toHaveLength(2)
    expect(ifDef!.outputs![0].id).toBe('true')
    expect(ifDef!.outputs![1].id).toBe('false')
  })

  it('Switch node has 5 outputs (4 routes + default)', () => {
    const switchDef = getNodeDefinition('n8n-nodes-base.switch')
    expect(switchDef).toBeDefined()
    expect(switchDef!.outputs).toHaveLength(5)
    expect(switchDef!.outputs![4].id).toBe('default')
  })

  it('Split in Batches has 2 outputs (done/loop)', () => {
    const splitDef = getNodeDefinition('n8n-nodes-base.splitInBatches')
    expect(splitDef).toBeDefined()
    expect(splitDef!.outputs).toHaveLength(2)
    expect(splitDef!.outputs![0].id).toBe('done')
    expect(splitDef!.outputs![1].id).toBe('loop')
  })

  it('no duplicate node types in registry', () => {
    const types = NODE_DEFINITIONS.map(d => d.type)
    const unique = new Set(types)
    expect(unique.size).toBe(types.length)
  })
})
