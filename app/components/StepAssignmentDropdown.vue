<script setup lang="ts">
import type { ShopUser } from '~/server/types/domain'
import type { SelectMenuItem } from '@nuxt/ui'

const props = defineProps<{
  stepId: string
  currentAssignee?: string
  users: ShopUser[]
}>()

const emit = defineEmits<{
  assigned: [stepId: string, userId: string | null]
}>()

const toast = useToast()

/**
 * Pure filter logic for dropdown options.
 * Exported conceptually for property testing — the actual function is
 * duplicated in tests/properties/dropdownFilter.property.test.ts
 * to avoid Vue component import issues in test environment.
 *
 * Returns "Unassigned" as first option, then users whose name contains
 * the search string (case-insensitive partial match).
 * "Unassigned" is always visible regardless of search input.
 */
function filterDropdownOptions(users: ShopUser[], search: string): SelectMenuItem[] {
  const unassignedOption: SelectMenuItem = {
    label: 'Unassigned',
    value: null as any,
    icon: 'i-lucide-user-x',
  }

  const normalizedSearch = search.toLowerCase().trim()

  const userOptions: SelectMenuItem[] = users
    .filter(u => u.active && (normalizedSearch === '' || u.name.toLowerCase().includes(normalizedSearch)))
    .map(u => ({
      label: u.name,
      value: u.id,
      icon: 'i-lucide-user',
    }))

  return [unassignedOption, ...userOptions]
}

// Internal state
const selectedValue = ref<string | null>(props.currentAssignee ?? null)
const previousValue = ref<string | null>(props.currentAssignee ?? null)
const assigning = ref(false)

// Sync with prop changes from parent
watch(() => props.currentAssignee, (val) => {
  selectedValue.value = val ?? null
  previousValue.value = val ?? null
})

// Build items for USelectMenu
const menuItems = computed<SelectMenuItem[]>(() => {
  return filterDropdownOptions(props.users, '')
})

// Display label for current selection
const displayLabel = computed(() => {
  if (!selectedValue.value) return 'Unassigned'
  const user = props.users.find(u => u.id === selectedValue.value)
  return user?.name ?? 'Unassigned'
})

async function handleSelection(value: string | null) {
  const userId = value
  const oldValue = previousValue.value

  // Optimistic update
  selectedValue.value = userId
  previousValue.value = userId
  assigning.value = true

  try {
    await $fetch(`/api/steps/${props.stepId}/assign`, {
      method: 'PATCH',
      body: { userId },
    })
    emit('assigned', props.stepId, userId)
  } catch (e: any) {
    // Revert on failure
    selectedValue.value = oldValue
    previousValue.value = oldValue
    toast.add({
      title: 'Assignment failed',
      description: e?.data?.message ?? e?.message ?? 'Could not update step assignment',
      color: 'error',
    })
  } finally {
    assigning.value = false
  }
}
</script>

<template>
  <USelectMenu
    :model-value="selectedValue"
    :items="menuItems"
    value-key="value"
    size="sm"
    :placeholder="displayLabel"
    :loading="assigning"
    class="w-full"
    @update:model-value="handleSelection"
  >
    <template #default>
      <span class="truncate text-xs">{{ displayLabel }}</span>
    </template>
  </USelectMenu>
</template>
