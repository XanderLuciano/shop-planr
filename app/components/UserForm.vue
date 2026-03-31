<script setup lang="ts">
import type { ShopUser } from '~/types/domain'

const props = defineProps<{
  user?: ShopUser
}>()

const emit = defineEmits<{
  submit: [data: { name: string, department?: string, active?: boolean }]
  cancel: []
}>()

const name = ref(props.user?.name ?? '')
const department = ref(props.user?.department ?? '')
const active = ref(props.user?.active ?? true)
const formError = ref('')

function onSubmit() {
  formError.value = ''
  if (!name.value.trim()) {
    formError.value = 'Name is required'
    return
  }
  emit('submit', {
    name: name.value.trim(),
    department: department.value.trim() || undefined,
    ...(props.user ? { active: active.value } : {})
  })
}
</script>

<template>
  <div class="space-y-2">
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Name</label>
        <UInput
          v-model="name"
          size="sm"
          placeholder="Full name"
        />
      </div>
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Department</label>
        <UInput
          v-model="department"
          size="sm"
          placeholder="e.g. Machining, QC"
        />
      </div>
    </div>
    <div
      v-if="user"
      class="flex items-center gap-2"
    >
      <USwitch
        v-model="active"
        size="sm"
      />
      <span class="text-xs text-(--ui-text-muted)">Active</span>
    </div>
    <p
      v-if="formError"
      class="text-xs text-red-500"
    >
      {{ formError }}
    </p>
    <div class="flex gap-2 justify-end">
      <UButton
        variant="ghost"
        size="xs"
        label="Cancel"
        @click="emit('cancel')"
      />
      <UButton
        size="xs"
        :label="user ? 'Save' : 'Create User'"
        @click="onSubmit"
      />
    </div>
  </div>
</template>
