<script setup lang="ts">
import type { ShopUser } from '~/types/domain'

const props = defineProps<{
  user?: ShopUser
}>()

const emit = defineEmits<{
  submit: [data: { username: string, displayName: string, department?: string, active?: boolean, isAdmin?: boolean }]
  cancel: []
}>()

const username = ref(props.user?.username ?? '')
const displayName = ref(props.user?.displayName ?? '')
const department = ref(props.user?.department ?? '')
const active = ref(props.user?.active ?? true)
const isAdmin = ref(props.user?.isAdmin ?? false)
const formError = ref('')

function onSubmit() {
  formError.value = ''
  if (!username.value.trim()) {
    formError.value = 'Username is required'
    return
  }
  if (!displayName.value.trim()) {
    formError.value = 'Display name is required'
    return
  }
  emit('submit', {
    username: username.value.trim(),
    displayName: displayName.value.trim(),
    department: department.value.trim() || undefined,
    isAdmin: isAdmin.value,
    ...(props.user ? { active: active.value } : {}),
  })
}
</script>

<template>
  <div class="space-y-2">
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Username</label>
        <UInput
          v-model="username"
          size="sm"
          placeholder="Unique handle"
        />
      </div>
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Display Name</label>
        <UInput
          v-model="displayName"
          size="sm"
          placeholder="Full name"
        />
      </div>
    </div>
    <div>
      <label class="block text-xs text-(--ui-text-muted) mb-0.5">Department</label>
      <UInput
        v-model="department"
        size="sm"
        placeholder="e.g. Machining, QC"
      />
    </div>
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <USwitch
          v-model="isAdmin"
          size="sm"
        />
        <span class="text-xs text-(--ui-text-muted)">Admin</span>
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
