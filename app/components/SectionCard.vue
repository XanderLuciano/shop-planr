<script setup lang="ts">
defineProps<{
  title: string
  icon: string
}>()
</script>

<template>
  <UCard variant="outline" :ui="{ header: 'px-4 py-3 sm:px-4', body: 'p-4 sm:p-4' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon :name="icon" class="size-4 text-(--ui-text-muted)" />
        <span class="text-sm font-semibold text-(--ui-text-highlighted)">{{ title }}</span>
      </div>
    </template>
    <slot />
  </UCard>
</template>
