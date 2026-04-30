<script setup lang="ts">
import type { WorkflowVariable } from '~/utils/n8nVariables'
import { insertAtCursor } from '~/utils/n8nVariables'

const props = defineProps<{
  modelValue: string
  variables: WorkflowVariable[]
  placeholder?: string
  /** Render as a multi-line textarea instead of a single-line input */
  multiline?: boolean
  /** Rows for the textarea when multiline */
  rows?: number
  /** Additional CSS classes for the input element */
  inputClass?: string
  /** Disable the picker button */
  pickerDisabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

function handlePick(expression: string) {
  const el = inputRef.value
  if (!el) {
    // No focused input — append to the end
    emit('update:modelValue', props.modelValue + expression)
    return
  }
  const newValue = insertAtCursor(el, expression)
  emit('update:modelValue', newValue)
}
</script>

<template>
  <div class="flex items-start gap-1">
    <div class="flex-1 min-w-0">
      <textarea
        v-if="multiline"
        ref="inputRef"
        :value="modelValue"
        :placeholder="placeholder"
        :rows="rows ?? 3"
        class="w-full px-2.5 py-1.5 text-sm rounded-md border border-(--ui-border) bg-(--ui-bg) text-(--ui-text-highlighted) placeholder:text-(--ui-text-dimmed) focus:outline-none focus:ring-2 focus:ring-(--ui-primary) focus:border-transparent resize-y"
        :class="inputClass"
        @input="handleInput"
      />
      <input
        v-else
        ref="inputRef"
        :value="modelValue"
        :placeholder="placeholder"
        type="text"
        class="w-full px-2.5 py-1.5 text-sm rounded-md border border-(--ui-border) bg-(--ui-bg) text-(--ui-text-highlighted) placeholder:text-(--ui-text-dimmed) focus:outline-none focus:ring-2 focus:ring-(--ui-primary) focus:border-transparent"
        :class="inputClass"
        @input="handleInput"
      >
    </div>
    <N8nVariablePicker
      :variables="variables"
      :disabled="pickerDisabled"
      class="mt-0.5"
      @pick="handlePick"
    />
  </div>
</template>
