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
    emit('update:modelValue', name)
    newName.value = ''
    showNewInput.value = false
  } catch {
    // error handled by composable
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div class="space-y-1">
    <UInput
      :model-value="modelValue"
      :placeholder="`Search ${type}...`"
      size="sm"
      class="w-full"
      @update:model-value="(v: string | number) => { searchQuery = String(v); emit('update:modelValue', String(v)) }"
    />

    <div v-if="searchQuery && items.length" class="border border-(--ui-border) rounded-md max-h-32 overflow-y-auto">
      <button
        v-for="item in items"
        :key="item.value"
        type="button"
        class="w-full text-left px-2 py-1.5 text-xs hover:bg-(--ui-bg-elevated)/50 text-(--ui-text-highlighted)"
        @click="emit('update:modelValue', item.value); searchQuery = ''"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="!showNewInput">
      <button
        type="button"
        class="text-xs text-(--ui-primary) hover:underline"
        @click="showNewInput = true; newName = searchQuery"
      >
        + New {{ type }}
      </button>
    </div>
    <div v-else class="flex items-center gap-1">
      <UInput
        v-model="newName"
        :placeholder="`New ${type} name`"
        size="xs"
        class="flex-1"
        @keyup.enter="handleAddNew"
      />
      <UButton size="xs" label="Add" :loading="adding" @click="handleAddNew" />
      <UButton size="xs" variant="ghost" label="Cancel" @click="showNewInput = false" />
    </div>
  </div>
</template>
