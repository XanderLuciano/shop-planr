<script setup lang="ts">
import type { AdvancementMode } from '~/types/domain'

defineProps<{
  modelValue: AdvancementMode
  size?: 'xs' | 'sm' | 'md'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AdvancementMode]
}>()
</script>

<template>
  <div>
    <label class="block text-xs font-medium text-(--ui-text-muted) mb-0.5 flex items-center gap-1">
      Advancement Mode
      <UTooltip :ui="{ content: 'h-auto py-2 px-3', text: 'whitespace-normal' }">
        <UIcon
          name="i-lucide-info"
          class="size-3.5 text-(--ui-text-dimmed) cursor-help"
        />
        <template #content>
          <div class="text-xs space-y-1 max-w-64">
            <p
              v-for="opt in ADVANCEMENT_MODE_OPTIONS"
              :key="opt.value"
            >
              <span class="font-semibold">{{ opt.label }}:</span> {{ opt.description }}
            </p>
          </div>
        </template>
      </UTooltip>
    </label>
    <USelect
      :model-value="modelValue"
      :items="ADVANCEMENT_MODE_OPTIONS"
      :size="size ?? 'sm'"
      class="w-full"
      @update:model-value="emit('update:modelValue', $event as AdvancementMode)"
    />
  </div>
</template>
