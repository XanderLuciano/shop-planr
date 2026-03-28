<script setup lang="ts">
import { getMethodColor } from '~/utils/docsMethodColor'

const props = defineProps<{
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  description?: string
}>()

const expanded = ref(true)
const colors = computed(() => getMethodColor(props.method))
</script>

<template>
  <div class="my-6 rounded-lg border border-(--ui-border) overflow-hidden">
    <!-- Header -->
    <button
      class="flex w-full items-center gap-3 px-4 py-3 bg-(--ui-bg-elevated) hover:bg-(--ui-bg-elevated)/80 transition-colors cursor-pointer"
      @click="expanded = !expanded"
    >
      <span
        class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
        :class="[colors.bg, colors.text]"
      >
        {{ method }}
      </span>
      <code class="font-mono text-sm text-(--ui-text-highlighted)">{{ path }}</code>
      <UIcon
        :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="ml-auto size-4 text-(--ui-text-muted)"
      />
    </button>

    <!-- Description (only if provided) -->
    <p v-if="description" class="px-4 pt-3 pb-0 text-sm text-(--ui-text-muted)">
      {{ description }}
    </p>

    <!-- Collapsible slot content -->
    <div v-show="expanded" class="px-4 pb-4">
      <slot />
    </div>
  </div>
</template>
