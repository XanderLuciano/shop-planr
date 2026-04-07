<script setup lang="ts">
const emit = defineEmits<{
  submit: [pin: string]
}>()

const phase = ref<'create' | 'confirm'>('create')
const firstPin = ref('')
const error = ref('')

const createRef = ref<{ clear: () => void } | null>(null)
const confirmRef = ref<{ clear: () => void } | null>(null)

function handleFirstPin(pin: string) {
  firstPin.value = pin
  error.value = ''
  phase.value = 'confirm'
}

function handleConfirmPin(pin: string) {
  if (pin === firstPin.value) {
    emit('submit', pin)
  } else {
    error.value = "PINs don't match"
    firstPin.value = ''
    phase.value = 'create'
    nextTick(() => {
      createRef.value?.clear()
    })
  }
}

function handleInput() {
  if (error.value) {
    error.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <div v-if="phase === 'create'" class="flex flex-col items-center gap-3">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Create your PIN
      </p>
      <PinEntry
        ref="createRef"
        @submit="handleFirstPin"
      />
    </div>

    <div v-if="phase === 'confirm'" class="flex flex-col items-center gap-3">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Confirm your PIN
      </p>
      <PinEntry
        ref="confirmRef"
        @submit="handleConfirmPin"
      />
    </div>

    <p
      v-if="error"
      class="text-sm text-red-500 dark:text-red-400"
      role="alert"
      @click="handleInput"
    >
      {{ error }}
    </p>
  </div>
</template>
