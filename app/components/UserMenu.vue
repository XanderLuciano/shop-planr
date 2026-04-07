<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { authenticatedUser, switchUser, logout } = useAuth()

const items: DropdownMenuItem[][] = [
  [
    {
      label: 'Switch User',
      icon: 'i-lucide-repeat',
      onSelect: () => switchUser(),
    },
    {
      label: 'Log Out',
      icon: 'i-lucide-log-out',
      onSelect: () => logout(),
    },
  ],
]
</script>

<template>
  <UDropdownMenu v-if="authenticatedUser" :items="items">
    <button class="flex items-center gap-2 cursor-pointer">
      <UserAvatar
        :username="authenticatedUser.username"
        :display-name="authenticatedUser.displayName"
        size="sm"
      />
      <span class="text-sm font-medium">{{ authenticatedUser.displayName }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-4" />
    </button>
  </UDropdownMenu>
</template>
