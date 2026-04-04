<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type {
  GroupByDimension,
  WorkQueueFilterState,
  WorkQueuePreset,
} from '~/types/computed'

interface Props {
  groupBy: GroupByDimension
  filters: WorkQueueFilterState
  availableLocations: string[]
  availableSteps: string[]
  availableUsers: readonly { id: string, displayName: string }[]
  presets: WorkQueuePreset[]
  activePresetId: string | null
  searchQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
})

const emit = defineEmits<{
  'update:groupBy': [value: GroupByDimension]
  'update:filters': [value: WorkQueueFilterState]
  'update:searchQuery': [value: string]
  'clear': []
  'savePreset': [name: string]
  'loadPreset': [presetId: string]
  'deletePreset': [presetId: string]
}>()

// --- Group-by items ---
const groupByItems: { label: string, value: GroupByDimension }[] = [
  { label: 'By Location', value: 'location' },
  { label: 'By User', value: 'user' },
  { label: 'By Step', value: 'step' },
]

// --- Local select state (sentinel-safe) ---
const selectedGroupBy = computed({
  get: () => props.groupBy,
  set: (val: GroupByDimension) => emit('update:groupBy', val),
})

const selectedLocation = computed({
  get: () => props.filters.location ?? SELECT_ALL,
  set: (val: string | SelectAll) => {
    emit('update:filters', { ...props.filters, location: selectedAllOrUndefined(val) })
  },
})

const selectedStep = computed({
  get: () => props.filters.stepName ?? SELECT_ALL,
  set: (val: string | SelectAll) => {
    emit('update:filters', { ...props.filters, stepName: selectedAllOrUndefined(val) })
  },
})

const selectedUser = computed({
  get: () => props.filters.userId ?? SELECT_ALL,
  set: (val: string | SelectAll) => {
    emit('update:filters', { ...props.filters, userId: selectedAllOrUndefined(val) })
  },
})

// --- Filter dropdown items ---
const locationItems = computed(() => [
  { label: 'All Locations', value: SELECT_ALL },
  ...props.availableLocations.map(loc => ({ label: loc, value: loc })),
])

const stepItems = computed(() => [
  { label: 'All Steps', value: SELECT_ALL },
  ...props.availableSteps.map(s => ({ label: s, value: s })),
])

const userItems = computed(() => [
  { label: 'All Users', value: SELECT_ALL },
  ...props.availableUsers.map(u => ({ label: u.displayName, value: u.id })),
])

// --- Active filter count ---
const activeFilterCount = computed(() => {
  let count = 0
  if (props.filters.location) count++
  if (props.filters.stepName) count++
  if (props.filters.userId) count++
  if (props.searchQuery.trim()) count++
  return count
})

const hasActiveFilters = computed(() => activeFilterCount.value > 0)

// --- Search ---
const localSearch = computed({
  get: () => props.searchQuery,
  set: (val: string) => emit('update:searchQuery', val),
})

// --- Preset save dialog ---
const showPresetInput = ref(false)
const presetName = ref('')

function handleSavePreset() {
  const trimmed = presetName.value.trim()
  if (!trimmed || trimmed.length > 50) return
  emit('savePreset', trimmed)
  presetName.value = ''
  showPresetInput.value = false
}

// --- Preset dropdown items ---
const presetMenuItems = computed<DropdownMenuItem[][]>(() => {
  const items: DropdownMenuItem[][] = []

  // Save action
  items.push([
    {
      label: 'Save current filters…',
      icon: 'i-lucide-save',
      onSelect() {
        showPresetInput.value = true
      },
    },
  ])

  // Saved presets
  if (props.presets.length > 0) {
    items.push(
      props.presets.map(preset => ({
        label: preset.name,
        icon: preset.id === props.activePresetId ? 'i-lucide-check' : 'i-lucide-bookmark',
        onSelect() {
          emit('loadPreset', preset.id)
        },
      })),
    )

    // Delete section
    items.push(
      props.presets.map(preset => ({
        label: `Delete "${preset.name}"`,
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect() {
          emit('deletePreset', preset.id)
        },
      })),
    )
  }

  return items
})
</script>

<template>
  <div class="flex flex-wrap items-end gap-3 p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30">
    <!-- Group-by selector -->
    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Group By</label>
      <USelect
        v-model="selectedGroupBy"
        :items="groupByItems"
        value-key="value"
        label-key="label"
        size="xs"
        class="w-36"
      />
    </div>

    <!-- Location filter -->
    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Location</label>
      <USelect
        v-model="selectedLocation"
        :items="locationItems"
        value-key="value"
        label-key="label"
        size="xs"
        class="w-40"
      />
    </div>

    <!-- Step filter -->
    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Step</label>
      <USelect
        v-model="selectedStep"
        :items="stepItems"
        value-key="value"
        label-key="label"
        size="xs"
        class="w-40"
      />
    </div>

    <!-- User filter -->
    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">User</label>
      <USelect
        v-model="selectedUser"
        :items="userItems"
        value-key="value"
        label-key="label"
        size="xs"
        class="w-40"
      />
    </div>

    <!-- Text search -->
    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Search</label>
      <UInput
        v-model="localSearch"
        size="xs"
        placeholder="Search jobs, steps…"
        icon="i-lucide-search"
        class="w-48"
      />
    </div>

    <!-- Active filter count badge -->
    <UBadge
      v-if="hasActiveFilters"
      color="primary"
      variant="subtle"
      size="sm"
      class="self-center"
    >
      {{ activeFilterCount }} active
    </UBadge>

    <!-- Clear filters -->
    <UButton
      v-if="hasActiveFilters"
      size="xs"
      variant="ghost"
      icon="i-lucide-x"
      label="Clear filters"
      class="self-center"
      @click="emit('clear')"
    />

    <!-- Preset dropdown -->
    <UDropdownMenu
      :items="presetMenuItems"
      size="sm"
      :content="{ align: 'end' }"
    >
      <UButton
        size="xs"
        variant="soft"
        icon="i-lucide-bookmark"
        label="Presets"
        trailing-icon="i-lucide-chevron-down"
        class="self-center"
      />
    </UDropdownMenu>

    <!-- Inline preset save input (shown when user clicks "Save current filters…") -->
    <div
      v-if="showPresetInput"
      class="flex items-center gap-2 self-center"
    >
      <UInput
        v-model="presetName"
        size="xs"
        placeholder="Preset name…"
        class="w-40"
        autofocus
        @keydown.enter="handleSavePreset"
        @keydown.escape="showPresetInput = false"
      />
      <UButton
        size="xs"
        variant="soft"
        color="primary"
        label="Save"
        :disabled="!presetName.trim() || presetName.trim().length > 50"
        @click="handleSavePreset"
      />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="Cancel"
        @click="showPresetInput = false"
      />
    </div>
  </div>
</template>
