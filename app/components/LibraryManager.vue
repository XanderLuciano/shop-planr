<script setup lang="ts">
const {
  processes, locations, loading, error,
  fetchProcesses, fetchLocations,
  addProcess, removeProcess,
  addLocation, removeLocation,
} = useLibrary()

const newProcessName = ref('')
const newLocationName = ref('')
const deleteConfirm = ref<string | null>(null)

onMounted(async () => {
  await Promise.all([fetchProcesses(), fetchLocations()])
})

async function handleAddProcess() {
  const name = newProcessName.value.trim()
  if (!name) return
  await addProcess(name)
  newProcessName.value = ''
}

async function handleAddLocation() {
  const name = newLocationName.value.trim()
  if (!name) return
  await addLocation(name)
  newLocationName.value = ''
}

async function handleDeleteProcess(id: string) {
  if (deleteConfirm.value !== id) {
    deleteConfirm.value = id
    return
  }
  await removeProcess(id)
  deleteConfirm.value = null
}

async function handleDeleteLocation(id: string) {
  if (deleteConfirm.value !== id) {
    deleteConfirm.value = id
    return
  }
  await removeLocation(id)
  deleteConfirm.value = null
}
</script>

<template>
  <div class="space-y-6">
    <p
      v-if="error"
      class="text-sm text-(--ui-error)"
    >
      {{ error }}
    </p>

    <!-- Process Library -->
    <div>
      <h4 class="text-sm font-semibold text-(--ui-text-highlighted) mb-2">
        Process Library
      </h4>
      <div class="border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
        <div
          v-for="p in processes"
          :key="p.id"
          class="px-3 py-2 flex items-center justify-between text-sm"
        >
          <span class="text-(--ui-text-highlighted)">{{ p.name }}</span>
          <UButton
            size="xs"
            :color="deleteConfirm === p.id ? 'error' : 'neutral'"
            variant="soft"
            :label="deleteConfirm === p.id ? 'Confirm?' : 'Delete'"
            icon="i-lucide-trash-2"
            :loading="loading"
            @click="handleDeleteProcess(p.id)"
            @blur="deleteConfirm = null"
          />
        </div>
        <div
          v-if="!processes.length"
          class="px-3 py-2 text-sm text-(--ui-text-muted)"
        >
          No processes defined
        </div>
      </div>
      <div class="flex items-center gap-2 mt-2">
        <UInput
          v-model="newProcessName"
          placeholder="New process name"
          size="sm"
          class="flex-1"
          @keyup.enter="handleAddProcess"
        />
        <UButton
          size="sm"
          label="Add"
          :loading="loading"
          @click="handleAddProcess"
        />
      </div>
    </div>

    <!-- Location Library -->
    <div>
      <h4 class="text-sm font-semibold text-(--ui-text-highlighted) mb-2">
        Location Library
      </h4>
      <div class="border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
        <div
          v-for="l in locations"
          :key="l.id"
          class="px-3 py-2 flex items-center justify-between text-sm"
        >
          <span class="text-(--ui-text-highlighted)">{{ l.name }}</span>
          <UButton
            size="xs"
            :color="deleteConfirm === l.id ? 'error' : 'neutral'"
            variant="soft"
            :label="deleteConfirm === l.id ? 'Confirm?' : 'Delete'"
            icon="i-lucide-trash-2"
            :loading="loading"
            @click="handleDeleteLocation(l.id)"
            @blur="deleteConfirm = null"
          />
        </div>
        <div
          v-if="!locations.length"
          class="px-3 py-2 text-sm text-(--ui-text-muted)"
        >
          No locations defined
        </div>
      </div>
      <div class="flex items-center gap-2 mt-2">
        <UInput
          v-model="newLocationName"
          placeholder="New location name"
          size="sm"
          class="flex-1"
          @keyup.enter="handleAddLocation"
        />
        <UButton
          size="sm"
          label="Add"
          :loading="loading"
          @click="handleAddLocation"
        />
      </div>
    </div>
  </div>
</template>
