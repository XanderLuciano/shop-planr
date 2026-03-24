<script setup lang="ts">
import { resolveComponent } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  value: number | string
  icon: string
  to?: string
  color?: string
}>(), {
  color: 'primary'
})
</script>

<template>
  <NuxtLink
    v-if="props.to"
    :to="props.to"
    class="block"
  >
    <UCard
      class="hover:ring-1 hover:ring-(--ui-border-accented) transition-shadow"
      :ui="{ body: 'p-3 sm:p-3' }"
    >
      <div class="flex items-center gap-3">
        <div class="shrink-0">
          <UIcon
            :name="props.icon"
            class="size-8 text-(--ui-primary)"
          />
        </div>
        <div class="min-w-0">
          <p class="text-xs text-(--ui-text-muted) truncate">
            {{ props.title }}
          </p>
          <p class="text-2xl font-bold text-(--ui-text-highlighted) leading-tight">
            {{ props.value }}
          </p>
        </div>
      </div>
    </UCard>
  </NuxtLink>
  <div v-else class="block">
    <UCard
      class="hover:ring-1 hover:ring-(--ui-border-accented) transition-shadow"
      :ui="{ body: 'p-3 sm:p-3' }"
    >
      <div class="flex items-center gap-3">
        <div class="shrink-0">
          <UIcon
            :name="props.icon"
            class="size-8 text-(--ui-primary)"
          />
        </div>
        <div class="min-w-0">
          <p class="text-xs text-(--ui-text-muted) truncate">
            {{ props.title }}
          </p>
          <p class="text-2xl font-bold text-(--ui-text-highlighted) leading-tight">
            {{ props.value }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
