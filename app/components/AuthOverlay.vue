<script setup lang="ts">
import type { ShopUser } from '~/types/domain'

const { showOverlay, users, login, setupPin, fetchUsers } = useAuth()

type OverlayState = 'picker' | 'pin-entry' | 'pin-setup'

const state = ref<OverlayState>('picker')
const selectedUser = ref<ShopUser | null>(null)
const error = ref('')

const pinEntryRef = ref<{ clear: () => void } | null>(null)

// Reset to picker whenever overlay becomes visible (e.g. after switch user)
watch(() => showOverlay.value, (visible) => {
  if (visible) {
    state.value = 'picker'
    selectedUser.value = null
    error.value = ''
    fetchUsers()
  }
})

onMounted(() => {
  fetchUsers()
})

function handleUserSelect(user: ShopUser) {
  selectedUser.value = user
  error.value = ''
  state.value = user.pinHash ? 'pin-entry' : 'pin-setup'
}

function handleBack() {
  state.value = 'picker'
  selectedUser.value = null
  error.value = ''
}

async function handlePinLogin(pin: string) {
  if (!selectedUser.value) return
  error.value = ''
  try {
    await login(selectedUser.value.username, pin)
  }
  catch {
    error.value = 'Invalid PIN'
    nextTick(() => pinEntryRef.value?.clear())
  }
}

async function handlePinSetup(pin: string) {
  if (!selectedUser.value) return
  error.value = ''
  try {
    await setupPin(selectedUser.value.id, pin)
  }
  catch {
    error.value = 'Failed to set up PIN. Please try again.'
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showOverlay"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div class="w-full max-w-md px-6">
        <!-- Avatar Picker -->
        <div v-if="state === 'picker'" class="flex flex-col items-center gap-8">
          <div class="text-center">
            <h1 class="text-3xl font-bold text-white">
              Shop Planr
            </h1>
            <p class="mt-2 text-gray-300">
              Select a user
            </p>
          </div>
          <AvatarPicker
            :users="users"
            @select="handleUserSelect"
          />
        </div>

        <!-- PIN Entry -->
        <div v-else-if="state === 'pin-entry' && selectedUser" class="flex flex-col items-center gap-6">
          <button
            type="button"
            class="self-start text-sm text-gray-300 hover:text-white transition-colors cursor-pointer"
            @click="handleBack"
          >
            ← Back
          </button>
          <UserAvatar
            :username="selectedUser.username"
            :display-name="selectedUser.displayName"
            size="lg"
          />
          <p class="text-lg font-medium text-white">
            {{ selectedUser.displayName }}
          </p>
          <p class="text-sm text-gray-300">
            Enter your PIN
          </p>
          <PinEntry
            ref="pinEntryRef"
            :error="error"
            @submit="handlePinLogin"
          />
          <p
            v-if="error"
            class="text-sm text-red-400"
            role="alert"
          >
            {{ error }}
          </p>
        </div>

        <!-- PIN Setup -->
        <div v-else-if="state === 'pin-setup' && selectedUser" class="flex flex-col items-center gap-6">
          <button
            type="button"
            class="self-start text-sm text-gray-300 hover:text-white transition-colors cursor-pointer"
            @click="handleBack"
          >
            ← Back
          </button>
          <UserAvatar
            :username="selectedUser.username"
            :display-name="selectedUser.displayName"
            size="lg"
          />
          <p class="text-lg font-medium text-white">
            {{ selectedUser.displayName }}
          </p>
          <PinSetup @submit="handlePinSetup" />
          <p
            v-if="error"
            class="text-sm text-red-400"
            role="alert"
          >
            {{ error }}
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
