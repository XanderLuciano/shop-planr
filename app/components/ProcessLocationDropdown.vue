<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  type: 'process' | 'location'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { processes, locations, fetchProcesses, fetchLocations, addProcess, addLocation } = useLibrary()

const searchQuery = ref('')
const showNewInput = ref(false)
const newName = ref('')
const adding = ref(false)
const showOverlay = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const items = computed(() => {
  const list = props.type === 'process' ? processes.value : locations.value
  const q = searchQuery.value.trim().toLowerCase()
  const filtered = q ? list.filter(e => e.name.toLowerCase().includes(q)) : list
  return filtered.map(e => ({ label: e.name, value: e.name }))
})

onMounted(async () => {
  if (props.type === 'process') {
    if (!processes.value.length) await fetchProcesses()
  } else {
    if (!locations.value.length) await fetchLocations()
  }
})

function handleInputUpdate(v: string | number) {
  const val = String(v)
  searchQuery.value = val
  emit('update:modelValue', val)
  showOverlay.value = val.trim().length > 0
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
</script>

<template>
  <div
    ref="containerRef"
    class="relative"
  >
    <UInput
      :model-value="modelValue"
      :data-testid="`process-location-input-${type}`"
      :placeholder="`Search ${type}...`"
      size="sm"
      class="w-full"
      @update:model-value="handleInputUpdate"
      @focus="handleInputFocus"
    />

    <div
      v-if="showOverlay && (items.length || showNewInput)"
      class="absolute top-full left-0 w-full z-10 mt-1 border border-(--ui-border) rounded-md bg-(--ui-bg) shadow-md max-h-48 overflow-y-auto"
    >
      <button
        v-for="item in items"
        :key="item.value"
        type="button"
        class="w-full text-left px-2 py-1.5 text-xs hover:bg-(--ui-bg-elevated)/50 text-(--ui-text-highlighted)"
        @click="selectItem(item.value)"
      >
        {{ item.label }}
      </button>

      <div
        v-if="!showNewInput"
        class="border-t border-(--ui-border)"
      >
        <button
          type="button"
          class="w-full text-left px-2 py-1.5 text-xs text-(--ui-primary) hover:bg-(--ui-bg-elevated)/50"
          @click="showNewInput = true; newName = searchQuery"
        >
          + New {{ type }}
        </button>
      </div>

      <div
        v-else
        class="border-t border-(--ui-border) p-2 flex items-center gap-1"
      >
        <UInput
          v-model="newName"
          :placeholder="`New ${type} name`"
          size="xs"
          class="flex-1"
          @keyup.enter="handleAddNew"
        />
        <UButton
          size="xs"
          label="Add"
          :loading="adding"
          @click="handleAddNew"
        />
        <UButton
          size="xs"
          variant="ghost"
          label="Cancel"
          @click="showNewInput = false"
        />
      </div>
    </div>
  </div>
</template>
