<script setup lang="ts">
defineProps<{
  userName: string
  department?: string
  jobCount: number
}>()
</script>

<template>
  <div class="border border-(--ui-border) rounded-md p-3 space-y-2">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-user"
          class="size-4 text-(--ui-text-muted)"
        />
        <span class="text-sm font-semibold text-(--ui-text-highlighted)">{{ userName }}</span>
        <UBadge
          v-if="department"
          color="neutral"
          variant="subtle"
          size="xs"
        >
          {{ department }}
        </UBadge>
      </div>
      <UBadge
        color="primary"
        variant="subtle"
        size="xs"
      >
        {{ jobCount }} job{{ jobCount !== 1 ? 's' : '' }}
      </UBadge>
    </div>

    <div
      v-if="jobCount === 0"
      class="text-xs text-(--ui-text-muted) py-2"
    >
      No jobs currently assigned.
    </div>

    <slot />
  </div>
</template>
