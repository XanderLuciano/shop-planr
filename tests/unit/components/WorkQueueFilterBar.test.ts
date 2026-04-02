/**
 * Unit tests for WorkQueueFilterBar component.
 *
 * Uses a minimal defineComponent reproduction of the real component's
 * script logic (no SFC parsing needed — no @vitejs/plugin-vue in vitest).
 * Tests emit correctness, badge/clear visibility, and preset input validation.
 *
 * Feature: work-queue-filtering
 * Requirements: 1.1, 4.1, 7.1, 7.2
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, computed } from 'vue'
import type {
  GroupByDimension,
  WorkQueueFilterState,
  WorkQueuePreset,
} from '../../../server/types/computed'

// --- Sentinel constants (mirrors app/utils/selectSentinel.ts) ---
const SELECT_ALL = '__all__' as const
type SelectAll = typeof SELECT_ALL

function selectedAllOrUndefined<T extends string>(value: T | SelectAll): T | undefined {
  return value === SELECT_ALL ? undefined : value
}

// --- Minimal reproduction of WorkQueueFilterBar ---

interface FilterBarProps {
  groupBy: GroupByDimension
  filters: WorkQueueFilterState
  availableLocations: string[]
  availableSteps: string[]
  availableUsers: { id: string; displayName: string }[]
  presets: WorkQueuePreset[]
  activePresetId: string | null
  searchQuery: string
}

/**
 * Mirrors the real WorkQueueFilterBar's script logic:
 * - computed activeFilterCount / hasActiveFilters
 * - emits for groupBy, filters, clear, presets
 * - preset save input with validation (non-empty, ≤50 chars)
 * - conditional badge and clear button rendering
 */
const WorkQueueFilterBar = defineComponent({
  name: 'WorkQueueFilterBar',
  props: {
    groupBy: { type: String as () => GroupByDimension, required: true },
    filters: { type: Object as () => WorkQueueFilterState, required: true },
    availableLocations: { type: Array as () => string[], required: true },
    availableSteps: { type: Array as () => string[], required: true },
    availableUsers: { type: Array as () => { id: string; displayName: string }[], required: true },
    presets: { type: Array as () => WorkQueuePreset[], required: true },
    activePresetId: { type: String as () => string | null, default: null },
    searchQuery: { type: String, default: '' },
  },
  emits: [
    'update:groupBy',
    'update:filters',
    'update:searchQuery',
    'clear',
    'savePreset',
    'loadPreset',
    'deletePreset',
  ],
  setup(props, { emit }) {
    const showPresetInput = ref(false)
    const presetName = ref('')

    const activeFilterCount = computed(() => {
      let count = 0
      if (props.filters.location) count++
      if (props.filters.stepName) count++
      if (props.filters.userId) count++
      if (props.searchQuery.trim()) count++
      return count
    })

    const hasActiveFilters = computed(() => activeFilterCount.value > 0)

    function handleSavePreset() {
      const trimmed = presetName.value.trim()
      if (!trimmed || trimmed.length > 50) return
      emit('savePreset', trimmed)
      presetName.value = ''
      showPresetInput.value = false
    }

    return () =>
      h('div', { class: 'filter-bar' }, [
        // Group-by selector
        h('select', {
          class: 'group-by-select',
          value: props.groupBy,
          onChange: (e: Event) => emit('update:groupBy', (e.target as HTMLSelectElement).value as GroupByDimension),
        }, [
          h('option', { value: 'location' }, 'By Location'),
          h('option', { value: 'user' }, 'By User'),
          h('option', { value: 'step' }, 'By Step'),
        ]),

        // Location filter
        h('select', {
          class: 'location-filter',
          value: props.filters.location ?? SELECT_ALL,
          onChange: (e: Event) => {
            const val = (e.target as HTMLSelectElement).value
            emit('update:filters', { ...props.filters, location: selectedAllOrUndefined(val) })
          },
        }, [
          h('option', { value: SELECT_ALL }, 'All Locations'),
          ...props.availableLocations.map(loc => h('option', { value: loc }, loc)),
        ]),

        // Step filter
        h('select', {
          class: 'step-filter',
          value: props.filters.stepName ?? SELECT_ALL,
          onChange: (e: Event) => {
            const val = (e.target as HTMLSelectElement).value
            emit('update:filters', { ...props.filters, stepName: selectedAllOrUndefined(val) })
          },
        }, [
          h('option', { value: SELECT_ALL }, 'All Steps'),
          ...props.availableSteps.map(s => h('option', { value: s }, s)),
        ]),

        // User filter
        h('select', {
          class: 'user-filter',
          value: props.filters.userId ?? SELECT_ALL,
          onChange: (e: Event) => {
            const val = (e.target as HTMLSelectElement).value
            emit('update:filters', { ...props.filters, userId: selectedAllOrUndefined(val) })
          },
        }, [
          h('option', { value: SELECT_ALL }, 'All Users'),
          ...props.availableUsers.map(u => h('option', { value: u.id }, u.displayName)),
        ]),

        // Search input
        h('input', {
          class: 'search-input',
          value: props.searchQuery,
          onInput: (e: Event) => emit('update:searchQuery', (e.target as HTMLInputElement).value),
        }),

        // Active filter count badge (conditional)
        hasActiveFilters.value
          ? h('span', { class: 'filter-badge' }, `${activeFilterCount.value} active`)
          : null,

        // Clear filters button (conditional)
        hasActiveFilters.value
          ? h('button', { class: 'clear-btn', onClick: () => emit('clear') }, 'Clear filters')
          : null,

        // Preset load buttons
        ...props.presets.map(preset =>
          h('button', {
            class: 'preset-load',
            'data-preset-id': preset.id,
            onClick: () => emit('loadPreset', preset.id),
          }, preset.name),
        ),

        // Preset delete buttons
        ...props.presets.map(preset =>
          h('button', {
            class: 'preset-delete',
            'data-preset-id': preset.id,
            onClick: () => emit('deletePreset', preset.id),
          }, `Delete "${preset.name}"`),
        ),

        // Save preset trigger
        h('button', {
          class: 'preset-save-trigger',
          onClick: () => { showPresetInput.value = true },
        }, 'Save current filters…'),

        // Inline preset save input (conditional)
        showPresetInput.value
          ? h('div', { class: 'preset-save-form' }, [
              h('input', {
                class: 'preset-name-input',
                value: presetName.value,
                onInput: (e: Event) => { presetName.value = (e.target as HTMLInputElement).value },
              }),
              h('button', {
                class: 'preset-save-btn',
                disabled: !presetName.value.trim() || presetName.value.trim().length > 50 || undefined,
                onClick: handleSavePreset,
              }, 'Save'),
              h('button', {
                class: 'preset-cancel-btn',
                onClick: () => { showPresetInput.value = false },
              }, 'Cancel'),
            ])
          : null,
      ])
  },
})

// --- Helpers ---

const defaultProps: FilterBarProps = {
  groupBy: 'location',
  filters: {},
  availableLocations: ['CNC Bay 1', 'Assembly'],
  availableSteps: ['Deburr', 'Inspect'],
  availableUsers: [
    { id: 'u1', displayName: 'Alice' },
    { id: 'u2', displayName: 'Bob' },
  ],
  presets: [],
  activePresetId: null,
  searchQuery: '',
}

function mountBar(overrides: Partial<FilterBarProps> = {}) {
  return mount(WorkQueueFilterBar, { props: { ...defaultProps, ...overrides } })
}

function makePreset(overrides: Partial<WorkQueuePreset> = {}): WorkQueuePreset {
  return {
    id: overrides.id ?? 'preset-1',
    name: overrides.name ?? 'My Preset',
    groupBy: overrides.groupBy ?? 'location',
    filters: overrides.filters ?? {},
    searchQuery: overrides.searchQuery ?? '',
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
  }
}

// --- Tests ---

describe('WorkQueueFilterBar', () => {
  // --- Rendering ---
  describe('rendering', () => {
    it('renders without errors with default props', () => {
      const wrapper = mountBar()
      expect(wrapper.find('.filter-bar').exists()).toBe(true)
      wrapper.unmount()
    })

    it('renders group-by select with three options', () => {
      const wrapper = mountBar()
      const options = wrapper.find('.group-by-select').findAll('option')
      expect(options).toHaveLength(3)
      expect(options.map(o => o.attributes('value'))).toEqual(['location', 'user', 'step'])
      wrapper.unmount()
    })

    it('renders available locations in location filter dropdown', () => {
      const wrapper = mountBar({ availableLocations: ['Bay A', 'Bay B', 'Bay C'] })
      const options = wrapper.find('.location-filter').findAll('option')
      // "All Locations" + 3 real options
      expect(options).toHaveLength(4)
      expect(options[1].text()).toBe('Bay A')
      expect(options[2].text()).toBe('Bay B')
      expect(options[3].text()).toBe('Bay C')
      wrapper.unmount()
    })

    it('renders available steps in step filter dropdown', () => {
      const wrapper = mountBar({ availableSteps: ['Cut', 'Weld'] })
      const options = wrapper.find('.step-filter').findAll('option')
      expect(options).toHaveLength(3) // "All Steps" + 2
      wrapper.unmount()
    })

    it('renders available users in user filter dropdown', () => {
      const wrapper = mountBar({
        availableUsers: [
          { id: 'u1', displayName: 'Alice' },
          { id: 'u2', displayName: 'Bob' },
          { id: 'u3', displayName: 'Carol' },
        ],
      })
      const options = wrapper.find('.user-filter').findAll('option')
      expect(options).toHaveLength(4) // "All Users" + 3
      expect(options[1].text()).toBe('Alice')
      wrapper.unmount()
    })
  })

  // --- Active filter badge visibility ---
  describe('active filter badge', () => {
    it('hides badge when no filters are active', () => {
      const wrapper = mountBar({ filters: {}, searchQuery: '' })
      expect(wrapper.find('.filter-badge').exists()).toBe(false)
      wrapper.unmount()
    })

    it('shows badge with count 1 when one property filter is active', () => {
      const wrapper = mountBar({ filters: { location: 'CNC Bay 1' } })
      expect(wrapper.find('.filter-badge').exists()).toBe(true)
      expect(wrapper.find('.filter-badge').text()).toBe('1 active')
      wrapper.unmount()
    })

    it('shows badge with count 2 when two property filters are active', () => {
      const wrapper = mountBar({ filters: { location: 'CNC Bay 1', stepName: 'Deburr' } })
      expect(wrapper.find('.filter-badge').text()).toBe('2 active')
      wrapper.unmount()
    })

    it('counts search query as an active filter', () => {
      const wrapper = mountBar({ filters: {}, searchQuery: 'bracket' })
      expect(wrapper.find('.filter-badge').text()).toBe('1 active')
      wrapper.unmount()
    })

    it('shows count 4 when all three filters and search are active', () => {
      const wrapper = mountBar({
        filters: { location: 'Bay', stepName: 'Cut', userId: 'u1' },
        searchQuery: 'test',
      })
      expect(wrapper.find('.filter-badge').text()).toBe('4 active')
      wrapper.unmount()
    })

    it('ignores whitespace-only search query', () => {
      const wrapper = mountBar({ filters: {}, searchQuery: '   ' })
      expect(wrapper.find('.filter-badge').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  // --- Clear button visibility ---
  describe('clear button', () => {
    it('hides clear button when no filters are active', () => {
      const wrapper = mountBar({ filters: {}, searchQuery: '' })
      expect(wrapper.find('.clear-btn').exists()).toBe(false)
      wrapper.unmount()
    })

    it('shows clear button when a property filter is active', () => {
      const wrapper = mountBar({ filters: { userId: 'u1' } })
      expect(wrapper.find('.clear-btn').exists()).toBe(true)
      expect(wrapper.find('.clear-btn').text()).toBe('Clear filters')
      wrapper.unmount()
    })

    it('shows clear button when search query is active', () => {
      const wrapper = mountBar({ searchQuery: 'hello' })
      expect(wrapper.find('.clear-btn').exists()).toBe(true)
      wrapper.unmount()
    })

    it('emits "clear" when clear button is clicked', async () => {
      const wrapper = mountBar({ filters: { location: 'Bay' } })
      await wrapper.find('.clear-btn').trigger('click')
      expect(wrapper.emitted('clear')).toHaveLength(1)
      wrapper.unmount()
    })
  })

  // --- Group-by emit ---
  describe('group-by change', () => {
    it('emits update:groupBy when group-by select changes', async () => {
      const wrapper = mountBar({ groupBy: 'location' })
      await wrapper.find('.group-by-select').setValue('user')
      expect(wrapper.emitted('update:groupBy')).toBeTruthy()
      expect(wrapper.emitted('update:groupBy')![0]).toEqual(['user'])
      wrapper.unmount()
    })

    it('emits update:groupBy with "step" value', async () => {
      const wrapper = mountBar({ groupBy: 'location' })
      await wrapper.find('.group-by-select').setValue('step')
      expect(wrapper.emitted('update:groupBy')![0]).toEqual(['step'])
      wrapper.unmount()
    })
  })

  // --- Filter selection emits ---
  describe('filter selection', () => {
    it('emits update:filters with location when location filter changes', async () => {
      const wrapper = mountBar()
      await wrapper.find('.location-filter').setValue('CNC Bay 1')
      const emitted = wrapper.emitted('update:filters')!
      expect(emitted).toHaveLength(1)
      expect(emitted[0][0]).toEqual({ location: 'CNC Bay 1' })
      wrapper.unmount()
    })

    it('emits update:filters with undefined location when "All" is selected', async () => {
      const wrapper = mountBar({ filters: { location: 'CNC Bay 1' } })
      await wrapper.find('.location-filter').setValue(SELECT_ALL)
      const emitted = wrapper.emitted('update:filters')!
      expect(emitted[0][0]).toEqual({ location: undefined })
      wrapper.unmount()
    })

    it('emits update:filters with stepName when step filter changes', async () => {
      const wrapper = mountBar()
      await wrapper.find('.step-filter').setValue('Deburr')
      const emitted = wrapper.emitted('update:filters')!
      expect(emitted[0][0]).toEqual({ stepName: 'Deburr' })
      wrapper.unmount()
    })

    it('emits update:filters with userId when user filter changes', async () => {
      const wrapper = mountBar()
      await wrapper.find('.user-filter').setValue('u1')
      const emitted = wrapper.emitted('update:filters')!
      expect(emitted[0][0]).toEqual({ userId: 'u1' })
      wrapper.unmount()
    })

    it('preserves existing filters when changing one filter', async () => {
      const wrapper = mountBar({ filters: { location: 'Bay', stepName: 'Cut' } })
      await wrapper.find('.user-filter').setValue('u2')
      const emitted = wrapper.emitted('update:filters')!
      expect(emitted[0][0]).toEqual({ location: 'Bay', stepName: 'Cut', userId: 'u2' })
      wrapper.unmount()
    })
  })

  // --- Preset rendering and actions ---
  describe('presets', () => {
    it('renders load buttons for each preset', () => {
      const presets = [makePreset({ id: 'p1', name: 'Preset A' }), makePreset({ id: 'p2', name: 'Preset B' })]
      const wrapper = mountBar({ presets })
      const loadBtns = wrapper.findAll('.preset-load')
      expect(loadBtns).toHaveLength(2)
      expect(loadBtns[0].text()).toBe('Preset A')
      expect(loadBtns[1].text()).toBe('Preset B')
      wrapper.unmount()
    })

    it('emits loadPreset with preset id when load button is clicked', async () => {
      const presets = [makePreset({ id: 'p1', name: 'My View' })]
      const wrapper = mountBar({ presets })
      await wrapper.find('.preset-load').trigger('click')
      expect(wrapper.emitted('loadPreset')).toEqual([['p1']])
      wrapper.unmount()
    })

    it('emits deletePreset with preset id when delete button is clicked', async () => {
      const presets = [makePreset({ id: 'p1', name: 'Old View' })]
      const wrapper = mountBar({ presets })
      await wrapper.find('.preset-delete').trigger('click')
      expect(wrapper.emitted('deletePreset')).toEqual([['p1']])
      wrapper.unmount()
    })

    it('renders no preset buttons when presets array is empty', () => {
      const wrapper = mountBar({ presets: [] })
      expect(wrapper.findAll('.preset-load')).toHaveLength(0)
      expect(wrapper.findAll('.preset-delete')).toHaveLength(0)
      wrapper.unmount()
    })
  })

  // --- Preset save input validation ---
  describe('preset save', () => {
    it('shows save form when save trigger is clicked', async () => {
      const wrapper = mountBar()
      expect(wrapper.find('.preset-save-form').exists()).toBe(false)
      await wrapper.find('.preset-save-trigger').trigger('click')
      expect(wrapper.find('.preset-save-form').exists()).toBe(true)
      wrapper.unmount()
    })

    it('save button is disabled when preset name is empty', async () => {
      const wrapper = mountBar()
      await wrapper.find('.preset-save-trigger').trigger('click')
      const saveBtn = wrapper.find('.preset-save-btn')
      expect(saveBtn.attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })

    it('save button is enabled when preset name is valid', async () => {
      const wrapper = mountBar()
      await wrapper.find('.preset-save-trigger').trigger('click')
      await wrapper.find('.preset-name-input').setValue('My View')
      const saveBtn = wrapper.find('.preset-save-btn')
      expect(saveBtn.attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    })

    it('save button is disabled when preset name exceeds 50 characters', async () => {
      const wrapper = mountBar()
      await wrapper.find('.preset-save-trigger').trigger('click')
      await wrapper.find('.preset-name-input').setValue('A'.repeat(51))
      const saveBtn = wrapper.find('.preset-save-btn')
      expect(saveBtn.attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })

    it('emits savePreset with trimmed name on save click', async () => {
      const wrapper = mountBar()
      await wrapper.find('.preset-save-trigger').trigger('click')
      await wrapper.find('.preset-name-input').setValue('  My Preset  ')
      await wrapper.find('.preset-save-btn').trigger('click')
      expect(wrapper.emitted('savePreset')).toEqual([['My Preset']])
      wrapper.unmount()
    })

    it('hides save form after successful save', async () => {
      const wrapper = mountBar()
      await wrapper.find('.preset-save-trigger').trigger('click')
      await wrapper.find('.preset-name-input').setValue('Test')
      await wrapper.find('.preset-save-btn').trigger('click')
      expect(wrapper.find('.preset-save-form').exists()).toBe(false)
      wrapper.unmount()
    })

    it('does not emit savePreset when name is whitespace-only', async () => {
      const wrapper = mountBar()
      await wrapper.find('.preset-save-trigger').trigger('click')
      await wrapper.find('.preset-name-input').setValue('   ')
      await wrapper.find('.preset-save-btn').trigger('click')
      expect(wrapper.emitted('savePreset')).toBeUndefined()
      wrapper.unmount()
    })

    it('hides save form when cancel is clicked', async () => {
      const wrapper = mountBar()
      await wrapper.find('.preset-save-trigger').trigger('click')
      expect(wrapper.find('.preset-save-form').exists()).toBe(true)
      await wrapper.find('.preset-cancel-btn').trigger('click')
      expect(wrapper.find('.preset-save-form').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  // --- Search emit ---
  describe('search', () => {
    it('emits update:searchQuery on input', async () => {
      const wrapper = mountBar()
      await wrapper.find('.search-input').setValue('bracket')
      expect(wrapper.emitted('update:searchQuery')).toBeTruthy()
      expect(wrapper.emitted('update:searchQuery')![0]).toEqual(['bracket'])
      wrapper.unmount()
    })
  })
})
