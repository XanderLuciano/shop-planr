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
  clear: []
  savePreset: [name: string]
  loadPreset: [presetId: string]
  deletePreset: [presetId: string]
}>()

// --- Group-by toggle items ---
const groupByOptions: { label: string, icon: string, value: GroupByDimension }[] = [
  { label: 'Location', icon: 'i-lucide-map-pin', value: 'location' },
  { label: 'User', icon: 'i-lucide-user', value: 'user' },
  { label: 'Step', icon: 'i-lucide-layers', value: 'step' },
]

// --- Local select state (sentinel-safe) ---
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

// --- Active filter detection ---
const hasActiveFilters = computed(() => {
  return !!(props.filters.location || props.filters.stepName || props.filters.userId || props.searchQuery.trim())
})

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

  if (props.presets.length > 0) {
    items.push(
      props.presets.map(preset => ({
        label: preset.name,
        icon: preset.id === props.activePresetId
          ? 'i-lucide-check'
          : preset.id === MY_QUEUE_PRESET_ID
            ? 'i-lucide-user'
            : 'i-lucide-bookmark',
        onSelect() {
          emit('loadPreset', preset.id)
        },
      })),
    )
  }

  items.push([
    {
      label: 'Save current filters…',
      icon: 'i-lucide-save',
      onSelect() {
        showPresetInput.value = true
      },
    },
  ])

  const deletable = props.presets.filter(p => p.id !== MY_QUEUE_PRESET_ID)
  if (deletable.length > 0) {
    items.push(
      deletable.map(preset => ({
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
  <div class="p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30 space-y-3">
    <!-- Top row: group-by toggle (left) + presets & clear (right) -->
    <div class="flex items-center justify-between gap-3">
      <!-- Group-by toggle buttons -->
      <UFieldGroup
        orientation="horizontal"
        size="xs"
      >
        <UButton
          v-for="opt in groupByOptions"
          :key="opt.value"
          size="xs"
          :variant="props.groupBy === opt.value ? 'solid' : 'outline'"
          :color="props.groupBy === opt.value ? 'primary' : 'neutral'"
          :icon="opt.icon"
          :label="opt.label"
          @click="emit('update:groupBy', opt.value)"
        />
      </UFieldGroup>

      <!-- Right side: clear + presets -->
      <div class="flex items-center gap-2">
        <UButton
          v-if="hasActiveFilters"
          size="xs"
          variant="ghost"
          icon="i-lucide-x"
          label="Clear filters"
          @click="emit('clear')"
        />

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
          />
        </UDropdownMenu>

        <!-- Inline preset save input -->
        <template v-if="showPresetInput">
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
        </template>
      </div>
    </div>

    <!-- Bottom row: filter dropdowns + search -->
    <div class="flex flex-wrap items-end gap-3">
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
    </div>
  </div>
</template>
