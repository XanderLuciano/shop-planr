<script setup lang="ts">
const props = defineProps<{
  stepId: string
  currentAssignedTo?: string
  currentLocation?: string
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const { activeUsers, fetchActiveUsers } = useOperatorIdentity()
const { locations, fetchLocations } = useLibrary()
const toast = useToast()

const saving = ref(false)

// Assignee: use sentinel for unassigned
const selectedUserId = ref<string>(props.currentAssignedTo ?? SELECT_UNASSIGNED)

// Location: free text with library suggestions
const selectedLocation = ref(props.currentLocation ?? '')

// Build assignee dropdown items
const assigneeItems = computed(() => {
  const unassigned = { label: 'Unassigned', value: SELECT_UNASSIGNED }
  const userOptions = activeUsers.value
    .filter(u => u.active)
    .map(u => ({ label: u.displayName, value: u.id }))
  return [unassigned, ...userOptions]
})

// Build location dropdown items for suggestions
const locationItems = computed(() =>
  locations.value.map(l => ({ label: l.name, value: l.name })),
)

onMounted(async () => {
  // Fetch users and locations if not already cached
  if (!activeUsers.value.length) await fetchActiveUsers()
  if (!locations.value.length) await fetchLocations()
})

async function handleSave() {
  const newAssignee = selectedOrNull(selectedUserId.value as string)
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
      await $fetch(`/api/steps/${props.stepId}/assign`, {
        method: 'PATCH',
        body: { userId: newAssignee },
      })
    }

    if (locationChanged) {
      await $fetch(`/api/steps/${props.stepId}/config`, {
        method: 'PATCH',
        body: { location: newLocation },
      })
    }

    toast.add({
      title: 'Step updated',
      description: 'Step properties saved successfully.',
      color: 'success',
    })
    emit('saved')
  } catch (e: any) {
    const message = e?.data?.message ?? e?.message ?? 'Save failed'
    toast.add({
      title: 'Save failed',
      description: message,
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <!-- Assignee dropdown -->
    <USelect
      v-model="selectedUserId"
      :items="assigneeItems"
      size="sm"
      class="w-40"
      :disabled="saving"
    />

    <!-- Location input with library suggestions -->
    <UInput
      v-model="selectedLocation"
      placeholder="Location..."
      size="sm"
      class="w-40"
      :disabled="saving"
      list="step-location-suggestions"
    />
    <datalist id="step-location-suggestions">
      <option
        v-for="loc in locationItems"
        :key="loc.value"
        :value="loc.value"
      />
    </datalist>

    <!-- Save button -->
    <UButton
      size="sm"
      label="Save"
      icon="i-lucide-check"
      :loading="saving"
      @click="handleSave"
    />

    <!-- Cancel button -->
    <UButton
      size="sm"
      variant="ghost"
      label="Cancel"
      icon="i-lucide-x"
      :disabled="saving"
      @click="emit('cancel')"
    />
  </div>
</template>
