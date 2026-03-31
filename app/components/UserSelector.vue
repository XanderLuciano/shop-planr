<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { users, selectedUser, selectUser, init } = useUsers()

onMounted(() => {
  init()
})

const menuItems = computed<DropdownMenuItem[][]>(() => {
  if (!users.value.length) {
    return [[{ label: 'No users available', disabled: true }]]
  }

  return [
    users.value.map(user => ({
      label: user.name,
      icon: user.id === selectedUser.value?.id ? 'i-lucide-check' : 'i-lucide-user',
      onSelect() {
        selectUser(user)
      }
    }))
  ]
})
</script>

<template>
  <UDropdownMenu
    :items="menuItems"
    size="sm"
    :content="{ align: 'end' }"
  >
    <!-- Mobile: icon-only, no label, no chevron -->
    <UButton
      class="md:hidden"
      size="sm"
      :variant="selectedUser ? 'ghost' : 'soft'"
      :color="selectedUser ? 'neutral' : 'warning'"
      :icon="selectedUser ? 'i-lucide-user' : 'i-lucide-user-x'"
      :aria-label="selectedUser?.name ?? 'Select User'"
    />
    <!-- Desktop: full label with trailing chevron -->
    <UButton
      class="hidden md:inline-flex"
      size="sm"
      :variant="selectedUser ? 'ghost' : 'soft'"
      :color="selectedUser ? 'neutral' : 'warning'"
      :icon="selectedUser ? 'i-lucide-user' : 'i-lucide-user-x'"
      :label="selectedUser?.name ?? 'Select User'"
      trailing-icon="i-lucide-chevron-down"
    />
  </UDropdownMenu>
</template>
