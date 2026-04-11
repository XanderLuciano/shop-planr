/**
 * Unit tests for ProcessLocationDropdown floating overlay.
 *
 * Uses a minimal defineComponent reproduction of the real component's
 * script logic (no SFC parsing — no @vitejs/plugin-vue in vitest).
 * Tests overlay positioning, close-on-select, close-on-click-outside,
 * and "New" input rendering inside the overlay.
 *
 * Feature: unified-path-editor
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref, computed, h, onMounted, onUnmounted } from 'vue'

// ── Mock state ──
let mockProcesses: ReturnType<typeof ref>
let mockLocations: ReturnType<typeof ref>
let mockFetchProcesses: ReturnType<typeof vi.fn>
let mockFetchLocations: ReturnType<typeof vi.fn>
let mockAddProcess: ReturnType<typeof vi.fn>
let mockAddLocation: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockProcesses = ref([
    { id: '1', name: 'Heat Treat' },
    { id: '2', name: 'QC Inspect' },
    { id: '3', name: 'Shipping' },
  ])
  mockLocations = ref([
    { id: '1', name: 'Bay 1' },
    { id: '2', name: 'Bay 2' },
  ])
  mockFetchProcesses = vi.fn()
  mockFetchLocations = vi.fn()
  mockAddProcess = vi.fn().mockResolvedValue({ id: '99', name: 'New Process' })
  mockAddLocation = vi.fn().mockResolvedValue({ id: '99', name: 'New Location' })
})

/**
 * Minimal reproduction of ProcessLocationDropdown logic.
 * Mirrors the real component's props, emits, overlay behavior,
 * click-outside handling, and "New" input rendering.
 */
const ProcessLocationDropdown = defineComponent({
  name: 'ProcessLocationDropdown',
  props: {
    modelValue: { type: String, required: true },
    type: { type: String as () => 'process' | 'location', required: true },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const processes = mockProcesses
    const locations = mockLocations
    const fetchProcesses = mockFetchProcesses
    const fetchLocations = mockFetchLocations
    const addProcess = mockAddProcess
    const addLocation = mockAddLocation

    const searchQuery = ref('')
    const showNewInput = ref(false)
    const newName = ref('')
    const adding = ref(false)
    const showOverlay = ref(false)
    const containerRef = ref<HTMLElement | null>(null)

    const items = computed(() => {
      const list = props.type === 'process' ? processes.value : locations.value
      const q = searchQuery.value.trim().toLowerCase()
      const filtered = q ? list.filter((e: any) => e.name.toLowerCase().includes(q)) : list
      return filtered.map((e: any) => ({ label: e.name, value: e.name }))
    })

    onMounted(async () => {
      if (props.type === 'process') {
        if (!processes.value.length) await fetchProcesses()
      } else {
        if (!locations.value.length) await fetchLocations()
      }
    })

    function handleInputUpdate(v: string) {
      searchQuery.value = v
      emit('update:modelValue', v)
      showOverlay.value = v.trim().length > 0
    }

    function handleInputFocus() {
      if (searchQuery.value.trim().length > 0 || items.value.length > 0) {
        showOverlay.value = true
      }
    }

    function selectItem(value: string) {
      emit('update:modelValue', value)
      searchQuery.value = ''
      showOverlay.value = false
      showNewInput.value = false
    }

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
        showOverlay.value = false
        showNewInput.value = false
      }
    }

    onMounted(() => {
      document.addEventListener('click', handleClickOutside, true)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside, true)
    })

    async function handleAddNew() {
      const name = newName.value.trim()
      if (!name) return
      adding.value = true
      try {
        if (props.type === 'process') {
          await addProcess(name)
        } else {
          await addLocation(name)
        }
        selectItem(name)
        newName.value = ''
      } catch {
        // error handled by composable
      } finally {
        adding.value = false
      }
    }

    return () =>
      h('div', { ref: containerRef, class: 'relative' }, [
        // UInput replacement — plain input for testing
        h('input', {
          value: props.modelValue,
          placeholder: `Search ${props.type}...`,
          class: 'w-full',
          'data-testid': 'dropdown-input',
          onInput: (e: Event) => handleInputUpdate((e.target as HTMLInputElement).value),
          onFocus: () => handleInputFocus(),
        }),

        // Floating overlay
        showOverlay.value && (items.value.length || showNewInput.value)
          ? h('div', {
            class: 'absolute top-full left-0 w-full z-10 mt-1 border rounded-md shadow-md max-h-48 overflow-y-auto',
            'data-testid': 'overlay',
          }, [
            // Suggestion items
            ...items.value.map((item: { label: string, value: string }) =>
              h('button', {
                key: item.value,
                type: 'button',
                class: 'w-full text-left px-2 py-1.5 text-xs suggestion-item',
                'data-testid': `suggestion-${item.value}`,
                onClick: () => selectItem(item.value),
              }, item.label),
            ),

            // "New" button or input
            !showNewInput.value
              ? h('div', { class: 'border-t' }, [
                h('button', {
                  type: 'button',
                  class: 'w-full text-left px-2 py-1.5 text-xs',
                  'data-testid': 'new-button',
                  onClick: () => { showNewInput.value = true; newName.value = searchQuery.value },
                }, `+ New ${props.type}`),
              ])
              : h('div', {
                class: 'border-t p-2 flex items-center gap-1',
                'data-testid': 'new-input-row',
              }, [
                h('input', {
                  value: newName.value,
                  placeholder: `New ${props.type} name`,
                  class: 'flex-1',
                  'data-testid': 'new-name-input',
                  onInput: (e: Event) => { newName.value = (e.target as HTMLInputElement).value },
                  onKeyup: (e: KeyboardEvent) => { if (e.key === 'Enter') handleAddNew() },
                }),
                h('button', {
                  type: 'button',
                  'data-testid': 'add-button',
                  onClick: () => handleAddNew(),
                }, 'Add'),
                h('button', {
                  type: 'button',
                  'data-testid': 'cancel-new-button',
                  onClick: () => { showNewInput.value = false },
                }, 'Cancel'),
              ]),
          ])
          : null,
      ])
  },
})

// ── Helper ──
function mountDropdown(props: Partial<{ modelValue: string, type: 'process' | 'location' }> = {}) {
  return mount(ProcessLocationDropdown, {
    props: {
      modelValue: '',
      type: 'process',
      ...props,
    },
    attachTo: document.body,
  })
}

// ── Tests ──

describe('ProcessLocationDropdown floating overlay', () => {
  // Req 9.1: Suggestion list renders as absolute-positioned overlay
  describe('overlay positioning', () => {
    it('renders suggestion list with absolute positioning class', async () => {
      const wrapper = mountDropdown()
      const input = wrapper.find('[data-testid="dropdown-input"]')

      // Focus and type to trigger overlay
      await input.trigger('focus')
      await flushPromises()

      // Overlay should be visible (items exist from mock data)
      const overlay = wrapper.find('[data-testid="overlay"]')
      expect(overlay.exists()).toBe(true)
      expect(overlay.classes()).toContain('absolute')
    })

    it('container has relative positioning class', async () => {
      const wrapper = mountDropdown()
      const container = wrapper.find('div.relative')
      expect(container.exists()).toBe(true)
    })
  })

  // Req 9.3: Overlay closes on selection
  describe('close on selection', () => {
    it('closes overlay when a suggestion item is clicked', async () => {
      const wrapper = mountDropdown()
      const input = wrapper.find('[data-testid="dropdown-input"]')

      // Open overlay
      await input.trigger('focus')
      await flushPromises()

      expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(true)

      // Click a suggestion
      const suggestion = wrapper.find('[data-testid="suggestion-Heat Treat"]')
      await suggestion.trigger('click')
      await flushPromises()

      // Overlay should be closed
      expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(false)

      // Should have emitted the selected value
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      expect(emitted![emitted!.length - 1]).toEqual(['Heat Treat'])
    })
  })

  // Req 9.4: Overlay closes on click-outside
  describe('close on click-outside', () => {
    it('closes overlay when clicking outside the container', async () => {
      const wrapper = mountDropdown()
      const input = wrapper.find('[data-testid="dropdown-input"]')

      // Open overlay
      await input.trigger('focus')
      await flushPromises()

      expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(true)

      // Click outside — dispatch on document
      const outsideEl = document.createElement('div')
      document.body.appendChild(outsideEl)
      const clickEvent = new MouseEvent('click', { bubbles: true })
      outsideEl.dispatchEvent(clickEvent)
      await flushPromises()

      // Overlay should be closed
      expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(false)

      // Cleanup
      document.body.removeChild(outsideEl)
      wrapper.unmount()
    })
  })

  // Req 9.5: "New" input renders inside the overlay
  describe('new input inside overlay', () => {
    it('renders "New" input row inside the overlay when showNewInput is activated', async () => {
      const wrapper = mountDropdown()
      const input = wrapper.find('[data-testid="dropdown-input"]')

      // Open overlay
      await input.trigger('focus')
      await flushPromises()

      expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(true)

      // Click the "New" button
      const newButton = wrapper.find('[data-testid="new-button"]')
      expect(newButton.exists()).toBe(true)
      await newButton.trigger('click')
      await flushPromises()

      // "New" input row should be inside the overlay
      const overlay = wrapper.find('[data-testid="overlay"]')
      expect(overlay.exists()).toBe(true)
      const newInputRow = overlay.find('[data-testid="new-input-row"]')
      expect(newInputRow.exists()).toBe(true)

      // Should contain the name input and Add/Cancel buttons
      expect(newInputRow.find('[data-testid="new-name-input"]').exists()).toBe(true)
      expect(newInputRow.find('[data-testid="add-button"]').exists()).toBe(true)
      expect(newInputRow.find('[data-testid="cancel-new-button"]').exists()).toBe(true)

      wrapper.unmount()
    })
  })
})
