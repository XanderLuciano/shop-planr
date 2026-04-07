<script setup lang="ts">
import type { PublicUser } from '~/types/domain'

defineProps<{
  users: PublicUser[]
}>()

const emit = defineEmits<{
  select: [user: PublicUser]
}>()

function getFirstName(displayName: string): string {
  return displayName.split(' ')[0] ?? displayName
}
</script>

<template>
  <div class="flex flex-wrap justify-center gap-6">
    <button
      v-for="user in users"
      :key="user.id"
      type="button"
      class="flex flex-col items-center gap-2 rounded-lg p-3 cursor-pointer transition-transform duration-150 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
      @click="emit('select', user)"
    >
      <UserAvatar
        :username="user.username"
        :display-name="user.displayName"
        size="lg"
      />
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ getFirstName(user.displayName) }}
      </span>
    </button>
  </div>
</template>
