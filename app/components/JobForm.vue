<script setup lang="ts">
import type { Job } from '~/server/types/domain'

const props = defineProps<{
  job?: Job
}>()

const emit = defineEmits<{
  submit: [data: { name: string; goalQuantity: number }]
  cancel: []
}>()

const name = ref(props.job?.name ?? '')
const goalQuantity = ref(props.job?.goalQuantity ?? 1)
const nameError = ref('')
const qtyError = ref('')

function validate(): boolean {
  nameError.value = ''
  qtyError.value = ''
  let valid = true
  if (!name.value.trim()) {
    nameError.value = 'Name is required'
    valid = false
  }
  if (goalQuantity.value < 1) {
    qtyError.value = 'Goal quantity must be at least 1'
    valid = false
  }
  return valid
}

function onSubmit() {
  if (!validate()) return
  emit('submit', {
    name: name.value.trim(),
    goalQuantity: goalQuantity.value,
  })
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="onSubmit">
    <div>
      <label class="block text-xs font-medium text-(--ui-text-muted) mb-1">Job Name</label>
      <UInput v-model="name" size="sm" placeholder="Enter job name" class="w-full" />
      <p v-if="nameError" class="text-xs text-red-500 mt-0.5">
        {{ nameError }}
      </p>
    </div>
    <div>
      <label class="block text-xs font-medium text-(--ui-text-muted) mb-1">Goal Quantity</label>
      <UInput v-model.number="goalQuantity" type="number" size="sm" :min="1" class="w-full" />
      <p v-if="qtyError" class="text-xs text-red-500 mt-0.5">
        {{ qtyError }}
      </p>
    </div>
    <div class="flex gap-2 justify-end">
      <UButton variant="ghost" size="xs" label="Cancel" @click="emit('cancel')" />
      <UButton type="submit" size="xs" :label="props.job ? 'Update' : 'Create'" />
    </div>
  </form>
</template>
