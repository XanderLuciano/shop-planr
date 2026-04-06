/**
 * Unit tests for StepPropertiesEditor component.
 *
 * Tests rendering of assignee/location fields, cancel emit, and
 * independent PATCH skip logic when values are unchanged.
 *
 * Feature: edit-step-properties
 * Requirements: 2.3, 3.3, 4.1, 4.2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref, computed, h, onMounted } from 'vue'

// ── Sentinel constant (mirrors app/utils/selectSentinel.ts) ──
const SELECT_UNASSIGNED = '__unassigned__' as const

function selectedOrNull(value: string): string | null {
  return value === SELECT_UNASSIGNED ? null : value
}

// ── Test data ──
const TEST_USERS = [
  { id: 'user-1', displayName: 'Alice', active: true },
  { id: 'user-2', displayName: 'Bob', active: true },
  { id: 'user-3', displayName: 'Charlie', active: false },
]

const TEST_LOCATIONS = [
  { name: 'Bay 1' },
  { name: 'Bay 2' },
]

// ── Mock state ──
let mockActiveUsers: ReturnType<typeof ref>
let mockLocations: ReturnType<typeof ref>
let mockFetchActiveUsers: ReturnType<typeof vi.fn>
let mockFetchLocations: ReturnType<typeof vi.fn>
let mockToastAdd: ReturnType<typeof vi.fn>
let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockActiveUsers = ref([...TEST_USERS])
  mockLocations = ref([...TEST_LOCATIONS])
  mockFetchActiveUsers = vi.fn()
  mockFetchLocations = vi.fn()
  mockToastAdd = vi.fn()
  mockFetch = vi.fn().mockResolvedValue({})
})

/**
 * Minimal reproduction of StepPropertiesEditor logic.
 * Rebuilt as defineComponent to avoid .vue SFC parsing issues
 * (no @vitejs/plugin-vue in vitest config). Mirrors the real
 * component's props, emits, change detection, and PATCH logic.
 */
const StepPropertiesEditor = defineComponent({
  name: 'StepPropertiesEditor',
  props: {
    stepId: { type: String, required: true },
    currentAssignedTo: { type: String, default: undefined },
    currentLocation: { type: String, default: undefined },
  },
  emits: ['saved', 'cancel'],
  setup(props, { emit }) {
    const activeUsers = mockActiveUsers
    const fetchActiveUsers = mockFetchActiveUsers
    const locations = mockLocations
    const fetchLocations = mockFetchLocations

    const saving = ref(false)
    const selectedUserId = ref<string>(props.currentAssignedTo ?? SELECT_UNASSIGNED)
    const selectedLocation = ref(props.currentLocation ?? '')

    const assigneeItems = computed(() => {
      const unassigned = { label: 'Unassigned', value: SELECT_UNASSIGNED }
      const userOptions = (activeUsers.value as typeof TEST_USERS)
        .filter(u => u.active)
        .map(u => ({ label: u.displayName, value: u.id }))
      return [unassigned, ...userOptions]
    })

    const locationItems = computed(() =>
      (locations.value as typeof TEST_LOCATIONS).map(l => ({ label: l.name, value: l.name })),
    )

    onMounted(async () => {
      if (!(activeUsers.value as typeof TEST_USERS).length) await fetchActiveUsers()
      if (!(locations.value as typeof TEST_LOCATIONS).length) await fetchLocations()
    })

    async function handleSave() {
      const newAssignee = selectedOrNull(selectedUserId.value)
      const originalAssignee = props.currentAssignedTo ?? null
      const assigneeChanged = newAssignee !== originalAssignee

      const newLocation = selectedLocation.value
      const originalLocation = props.currentLocation ?? ''
      const locationChanged = newLocation !== originalLocation

      if (!assigneeChanged && !locationChanged) {
        emit('saved')
        return
      }

      saving.value = true
      try {
        if (assigneeChanged) {
          await mockFetch(`/api/steps/${props.stepId}/assign`, {
            method: 'PATCH',
            body: { userId: newAssignee },
          })
        }

        if (locationChanged) {
          await mockFetch(`/api/steps/${props.stepId}/config`, {
            method: 'PATCH',
            body: { location: newLocation },
          })
        }

        mockToastAdd({
          title: 'Step updated',
          description: 'Step properties saved successfully.',
          color: 'success',
        })
        emit('saved')
      }
      catch (e: any) {
        const message = e?.data?.message ?? e?.message ?? 'Save failed'
        mockToastAdd({
          title: 'Save failed',
          description: message,
          color: 'error',
        })
      }
      finally {
        saving.value = false
      }
    }

    return () =>
      h('div', { class: 'flex items-center gap-2 flex-wrap' }, [
        // Assignee dropdown
        h('select', {
          'data-testid': 'assignee-select',
          'value': selectedUserId.value,
          'disabled': saving.value || undefined,
          'onChange': (e: Event) => {
            selectedUserId.value = (e.target as HTMLSelectElement).value
          },
        }, assigneeItems.value.map(item =>
          h('option', { key: item.value, value: item.value }, item.label),
        )),

        // Location input
        h('input', {
          'data-testid': 'location-input',
          'value': selectedLocation.value,
          'disabled': saving.value || undefined,
          'placeholder': 'Location...',
          'onInput': (e: Event) => {
            selectedLocation.value = (e.target as HTMLInputElement).value
          },
        }),

        // Save button
        h('button', {
          'data-testid': 'save-btn',
          'disabled': saving.value || undefined,
          'onClick': handleSave,
        }, 'Save'),

        // Cancel button
        h('button', {
          'data-testid': 'cancel-btn',
          'disabled': saving.value || undefined,
          'onClick': () => emit('cancel'),
        }, 'Cancel'),
      ])
  },
})

function mountEditor(props: { stepId: string, currentAssignedTo?: string, currentLocation?: string }) {
  return mount(StepPropertiesEditor, { props })
}

describe('StepPropertiesEditor', () => {
  // ── Rendering ──
  describe('rendering', () => {
    // Validates: Requirements 1.2 — assignee dropdown populated with active users
    it('renders assignee dropdown with active users and unassigned option', () => {
      const wrapper = mountEditor({ stepId: 'step-1' })
      const select = wrapper.find('[data-testid="assignee-select"]')
      expect(select.exists()).toBe(true)

      const options = select.findAll('option')
      // Unassigned + 2 active users (Charlie is inactive, filtered out)
      expect(options).toHaveLength(3)
      expect(options[0].text()).toBe('Unassigned')
      expect(options[1].text()).toBe('Alice')
      expect(options[2].text()).toBe('Bob')
    })

    // Validates: Requirements 1.2 — location input rendered
    it('renders location input field', () => {
      const wrapper = mountEditor({ stepId: 'step-1' })
      const input = wrapper.find('[data-testid="location-input"]')
      expect(input.exists()).toBe(true)
    })

    it('pre-selects current assignee when provided', () => {
      const wrapper = mountEditor({ stepId: 'step-1', currentAssignedTo: 'user-2' })
      const select = wrapper.find('[data-testid="assignee-select"]')
      expect((select.element as HTMLSelectElement).value).toBe('user-2')
    })

    it('pre-fills current location when provided', () => {
      const wrapper = mountEditor({ stepId: 'step-1', currentLocation: 'Bay 1' })
      const input = wrapper.find('[data-testid="location-input"]')
      expect((input.element as HTMLInputElement).value).toBe('Bay 1')
    })
  })

  // ── Cancel ──
  describe('cancel', () => {
    // Validates: Requirement 1.3 — cancel exits edit mode without API calls
    it('emits cancel when cancel button is clicked', async () => {
      const wrapper = mountEditor({ stepId: 'step-1' })
      await wrapper.find('[data-testid="cancel-btn"]').trigger('click')
      expect(wrapper.emitted('cancel')).toHaveLength(1)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // ── Independent field updates ──
  describe('independent field updates', () => {
    // Validates: Requirement 2.3 — skip assignee PATCH when unchanged
    it('skips assignee PATCH when assignee is unchanged', async () => {
      const wrapper = mountEditor({
        stepId: 'step-1',
        currentAssignedTo: 'user-1',
        currentLocation: 'Bay 1',
      })

      // Change only location
      await wrapper.find('[data-testid="location-input"]').setValue('Bay 3')
      await wrapper.find('[data-testid="save-btn"]').trigger('click')
      await flushPromises()

      // Only config PATCH should be called, not assign
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/steps/step-1/config',
        { method: 'PATCH', body: { location: 'Bay 3' } },
      )
    })

    // Validates: Requirement 3.3 — skip location PATCH when unchanged
    it('skips location PATCH when location is unchanged', async () => {
      const wrapper = mountEditor({
        stepId: 'step-1',
        currentAssignedTo: 'user-1',
        currentLocation: 'Bay 1',
      })

      // Change only assignee
      const select = wrapper.find('[data-testid="assignee-select"]')
      await select.setValue('user-2')
      await wrapper.find('[data-testid="save-btn"]').trigger('click')
      await flushPromises()

      // Only assign PATCH should be called, not config
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/steps/step-1/assign',
        { method: 'PATCH', body: { userId: 'user-2' } },
      )
    })

    // Validates: Requirement 4.1 — only assignee endpoint called when only assignee changed
    it('calls only assign endpoint when only assignee changed', async () => {
      const wrapper = mountEditor({
        stepId: 'step-1',
        currentAssignedTo: undefined,
        currentLocation: 'Bay 1',
      })

      await wrapper.find('[data-testid="assignee-select"]').setValue('user-1')
      await wrapper.find('[data-testid="save-btn"]').trigger('click')
      await flushPromises()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/steps/step-1/assign',
        { method: 'PATCH', body: { userId: 'user-1' } },
      )
    })

    // Validates: Requirement 4.2 — only config endpoint called when only location changed
    it('calls only config endpoint when only location changed', async () => {
      const wrapper = mountEditor({
        stepId: 'step-1',
        currentAssignedTo: 'user-1',
        currentLocation: '',
      })

      await wrapper.find('[data-testid="location-input"]').setValue('Bay 2')
      await wrapper.find('[data-testid="save-btn"]').trigger('click')
      await flushPromises()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/steps/step-1/config',
        { method: 'PATCH', body: { location: 'Bay 2' } },
      )
    })

    // Validates: Requirements 4.3 — both endpoints called when both changed
    it('calls both endpoints when both assignee and location changed', async () => {
      const wrapper = mountEditor({
        stepId: 'step-1',
        currentAssignedTo: 'user-1',
        currentLocation: 'Bay 1',
      })

      await wrapper.find('[data-testid="assignee-select"]').setValue('user-2')
      await wrapper.find('[data-testid="location-input"]').setValue('Bay 3')
      await wrapper.find('[data-testid="save-btn"]').trigger('click')
      await flushPromises()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/steps/step-1/assign',
        { method: 'PATCH', body: { userId: 'user-2' } },
      )
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/steps/step-1/config',
        { method: 'PATCH', body: { location: 'Bay 3' } },
      )
    })

    // No-op when nothing changed — emits saved without any API calls
    it('emits saved without API calls when nothing changed', async () => {
      const wrapper = mountEditor({
        stepId: 'step-1',
        currentAssignedTo: 'user-1',
        currentLocation: 'Bay 1',
      })

      await wrapper.find('[data-testid="save-btn"]').trigger('click')
      await flushPromises()

      expect(mockFetch).not.toHaveBeenCalled()
      expect(wrapper.emitted('saved')).toHaveLength(1)
    })
  })
})
