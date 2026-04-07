<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

const props = defineProps<{
  error?: string
}>()

const emit = defineEmits<{
  submit: [pin: string]
  'update:error': [value: string]
}>()

const inputRefs = ref<(HTMLInputElement | null)[]>([])
const digits = ref<string[]>(['', '', '', ''])

function setRef(index: number) {
  return (el: Element | ComponentPublicInstance | null) => {
    inputRefs.value[index] = el as HTMLInputElement | null
  }
}

function clearAll() {
  digits.value = ['', '', '', '']
  nextTick(() => inputRefs.value[0]?.focus())
}

function handleInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value

  // Clear error state on any input
  if (props.error) {
    emit('update:error', '')
    clearAll()
    return
  }

  // Accept only single digit 0-9
  const digit = value.replace(/\D/g, '').slice(-1)
  digits.value[index] = digit
  input.value = digit

  if (!digit) return

  // Auto-submit on 4th digit
  if (index === 3) {
    const pin = digits.value.join('')
    if (pin.length === 4) {
      emit('submit', pin)
    }
    return
  }

  // Auto-advance to next input
  nextTick(() => inputRefs.value[index + 1]?.focus())
}

function handleKeydown(index: number, event: KeyboardEvent) {
  // Clear error on any keypress and let the keystroke through
  if (props.error) {
    emit('update:error', '')
    clearAll()
    return
  }

  if (event.key === 'Backspace') {
    if (!digits.value[index] && index > 0) {
      // Move back if current is empty
      digits.value[index - 1] = ''
      nextTick(() => inputRefs.value[index - 1]?.focus())
    } else {
      digits.value[index] = ''
    }
  }
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault()

  if (props.error) {
    emit('update:error', '')
    clearAll()
    return
  }

  const pasted = event.clipboardData?.getData('text') ?? ''
  const digitsOnly = pasted.replace(/\D/g, '').slice(0, 4)

  for (let i = 0; i < 4; i++) {
    digits.value[i] = digitsOnly[i] ?? ''
  }

  if (digitsOnly.length === 4) {
    emit('submit', digitsOnly)
  } else {
    nextTick(() => inputRefs.value[digitsOnly.length]?.focus())
  }
}

/** Focus the first input on mount */
onMounted(() => {
  nextTick(() => inputRefs.value[0]?.focus())
})

/** Expose clearAll so parent components can reset */
defineExpose({ clear: clearAll })
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div
      class="flex gap-3"
      @paste="handlePaste"
    >
      <input
        v-for="(_, index) in 4"
        :key="index"
        :ref="setRef(index)"
        type="password"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="1"
        :value="digits[index]"
        :aria-label="`PIN digit ${index + 1}`"
        class="w-14 h-16 text-center text-2xl font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        @input="handleInput(index, $event)"
        @keydown="handleKeydown(index, $event)"
      >
    </div>

    <p
      v-if="error"
      class="text-sm text-red-500 dark:text-red-400"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>
