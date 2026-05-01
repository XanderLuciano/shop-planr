<script setup lang="ts">
import type { PublicUser, JiraConnectionSettings, JiraFieldMapping, N8nConnectionSettings, PageToggles } from '~/types/domain'

const { settings, loading, fetchSettings, updateSettings } = useSettings()
const { fetchUsers, isAdmin, authenticatedUser } = useAuth()
const $api = useAuthFetch()

// Tab state
const activeTab = ref('users')
const tabs = [
  { label: 'Users', value: 'users', icon: 'i-lucide-users' },
  { label: 'Jira Connection', value: 'jira', icon: 'i-lucide-plug' },
  { label: 'Field Mappings', value: 'mappings', icon: 'i-lucide-columns-3' },
  { label: 'n8n', value: 'n8n', icon: 'i-lucide-workflow' },
  { label: 'Process Library', value: 'libraries', icon: 'i-lucide-library' },
  { label: 'Tags', value: 'tags', icon: 'i-lucide-tag' },
  { label: 'Page Visibility', value: 'pages', icon: 'i-lucide-eye' },
]

// User management state
const allUsers = ref<PublicUser[]>([])
const showUserForm = ref(false)
const editingUser = ref<PublicUser | null>(null)
const userSaving = ref(false)
const userError = ref('')
const userSuccess = ref('')

// Settings save state
const settingsSaving = ref(false)
const settingsError = ref('')
const settingsSuccess = ref('')

async function loadAllUsers() {
  try {
    // The users composable fetches active users; we need all users for settings
    const all = await $api<PublicUser[]>('/api/users')
    allUsers.value = all
  } catch {
    allUsers.value = []
  }
}

async function onCreateUser(data: { username: string, displayName: string, department?: string, isAdmin?: boolean }) {
  userError.value = ''
  userSuccess.value = ''
  userSaving.value = true
  try {
    await $api('/api/users', { method: 'POST', body: data })
    showUserForm.value = false
    userSuccess.value = 'User created'
    await loadAllUsers()
    await fetchUsers()
  } catch (e) {
    userError.value = extractApiError(e, 'Failed to create user')
  } finally {
    userSaving.value = false
  }
}

async function onUpdateUser(data: { username?: string, displayName?: string, department?: string, active?: boolean, isAdmin?: boolean }) {
  if (!editingUser.value) return
  userError.value = ''
  userSuccess.value = ''
  userSaving.value = true
  try {
    await $api(`/api/users/${editingUser.value.id}`, { method: 'PUT', body: data })
    editingUser.value = null
    userSuccess.value = 'User updated'
    await loadAllUsers()
    await fetchUsers()
  } catch (e) {
    userError.value = extractApiError(e, 'Failed to update user')
  } finally {
    userSaving.value = false
  }
}

async function toggleUserActive(user: PublicUser) {
  userError.value = ''
  try {
    await $api(`/api/users/${user.id}`, {
      method: 'PUT',
      body: { active: !user.active },
    })
    await loadAllUsers()
    await fetchUsers()
  } catch (e) {
    userError.value = extractApiError(e, 'Failed to update user')
  }
}

async function resetUserPin(user: PublicUser) {
  userError.value = ''
  userSuccess.value = ''
  try {
    await $api('/api/auth/reset-pin', {
      method: 'POST',
      body: { targetUserId: user.id },
    })
    userSuccess.value = `PIN reset for ${user.displayName}. They will set a new PIN on next login.`
    await loadAllUsers()
  } catch (e: unknown) {
    userError.value = extractApiError(e, 'Failed to reset PIN')
  }
}

async function onSaveConnection(connection: Partial<JiraConnectionSettings>) {
  settingsError.value = ''
  settingsSuccess.value = ''
  settingsSaving.value = true
  try {
    await updateSettings({ jiraConnection: connection })
    settingsSuccess.value = 'Connection settings saved'
  } catch (e) {
    settingsError.value = extractApiError(e, 'Failed to save settings')
  } finally {
    settingsSaving.value = false
  }
}

async function onSaveN8nConnection(connection: Partial<N8nConnectionSettings>) {
  settingsError.value = ''
  settingsSuccess.value = ''
  settingsSaving.value = true
  try {
    await updateSettings({ n8nConnection: connection })
    settingsSuccess.value = 'n8n connection saved'
  } catch (e) {
    settingsError.value = extractApiError(e, 'Failed to save n8n connection')
  } finally {
    settingsSaving.value = false
  }
}

async function onSaveMappings(mappings: JiraFieldMapping[]) {
  settingsError.value = ''
  settingsSuccess.value = ''
  settingsSaving.value = true
  try {
    await updateSettings({ jiraFieldMappings: mappings })
    settingsSuccess.value = 'Field mappings saved'
  } catch (e) {
    settingsError.value = extractApiError(e, 'Failed to save mappings')
  } finally {
    settingsSaving.value = false
  }
}

async function onSaveToggles(toggles: PageToggles) {
  settingsError.value = ''
  settingsSuccess.value = ''
  settingsSaving.value = true
  try {
    await updateSettings({ pageToggles: toggles })
    settingsSuccess.value = 'Page visibility saved'
  } catch (e) {
    settingsError.value = extractApiError(e, 'Failed to save page visibility')
    // Revert toggles on failure — re-fetch settings to restore previous state
    await fetchSettings()
  } finally {
    settingsSaving.value = false
  }
}

const defaultConnection: JiraConnectionSettings = {
  baseUrl: '',
  projectKey: '',
  username: '',
  apiToken: '',
  enabled: false,
  pushEnabled: false,
}

const defaultN8nConnection: N8nConnectionSettings = {
  baseUrl: '',
  apiKey: '',
  enabled: false,
}

onMounted(async () => {
  await loadAllUsers()
})
</script>

<template>
  <div class="p-4 space-y-3 max-w-4xl">
    <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
      Settings
    </h1>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted)"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading settings...
    </div>

    <template v-else>
      <!-- Tabs -->
      <ScrollFadeTabs
        v-model="activeTab"
        :tabs="tabs"
        class="mb-3"
      />

      <!-- Users tab -->
      <div
        v-if="activeTab === 'users'"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-(--ui-text-highlighted)">User Management</span>
          <UButton
            v-if="!showUserForm && !editingUser"
            icon="i-lucide-plus"
            size="xs"
            label="New User"
            @click="showUserForm = true"
          />
        </div>

        <!-- Create user form -->
        <div
          v-if="showUserForm"
          class="p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50"
        >
          <div class="text-xs font-semibold text-(--ui-text-highlighted) mb-2">
            New User
          </div>
          <UserForm
            @submit="onCreateUser"
            @cancel="showUserForm = false"
          />
        </div>

        <!-- Edit user form -->
        <div
          v-if="editingUser"
          class="p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50"
        >
          <div class="text-xs font-semibold text-(--ui-text-highlighted) mb-2">
            Edit User
          </div>
          <UserForm
            :user="editingUser"
            @submit="onUpdateUser"
            @cancel="editingUser = null"
          />
        </div>

        <p
          v-if="userError"
          class="text-xs text-red-500"
        >
          {{ userError }}
        </p>
        <p
          v-if="userSuccess"
          class="text-xs text-green-600"
        >
          {{ userSuccess }}
        </p>

        <!-- User list -->
        <div
          v-if="!allUsers.length"
          class="text-sm text-(--ui-text-muted) py-4 text-center"
        >
          No users yet. Create a user to get started.
        </div>
        <div
          v-else
          class="space-y-1.5"
        >
          <div
            v-for="u in allUsers"
            :key="u.id"
            class="flex items-center justify-between px-3 py-2 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="text-sm font-medium text-(--ui-text-highlighted)">{{ u.displayName }}</span>
              <UBadge
                v-if="u.isAdmin"
                size="xs"
                color="primary"
                variant="subtle"
              >
                Admin
              </UBadge>
              <span
                v-if="u.department"
                class="text-xs text-(--ui-text-muted)"
              >{{ u.department }}</span>
              <UBadge
                size="xs"
                :color="u.active ? 'success' : 'neutral'"
                variant="subtle"
              >
                {{ u.active ? 'Active' : 'Inactive' }}
              </UBadge>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <UButton
                v-if="isAdmin && u.hasPin && u.id !== authenticatedUser?.id"
                icon="i-lucide-key-round"
                size="xs"
                variant="ghost"
                color="warning"
                title="Reset PIN"
                @click="resetUserPin(u)"
              />
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                variant="ghost"
                color="neutral"
                @click="editingUser = u; showUserForm = false"
              />
              <UButton
                :icon="u.active ? 'i-lucide-user-x' : 'i-lucide-user-check'"
                size="xs"
                variant="ghost"
                :color="u.active ? 'error' : 'success'"
                @click="toggleUserActive(u)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Jira Connection tab -->
      <div
        v-if="activeTab === 'jira'"
        class="space-y-3"
      >
        <span class="text-sm font-medium text-(--ui-text-highlighted)">Jira Connection</span>
        <div class="p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50">
          <JiraConnectionForm
            :connection="settings?.jiraConnection ?? defaultConnection"
            @save="onSaveConnection"
          />
        </div>
        <p
          v-if="settingsError"
          class="text-xs text-red-500"
        >
          {{ settingsError }}
        </p>
        <p
          v-if="settingsSuccess"
          class="text-xs text-green-600"
        >
          {{ settingsSuccess }}
        </p>
      </div>

      <!-- Field Mappings tab -->
      <div
        v-if="activeTab === 'mappings'"
        class="space-y-3"
      >
        <span class="text-sm font-medium text-(--ui-text-highlighted)">Jira Field Mappings</span>
        <div class="p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50">
          <JiraFieldMappingEditor
            :mappings="settings?.jiraFieldMappings ?? []"
            @save="onSaveMappings"
          />
        </div>
        <p
          v-if="settingsError"
          class="text-xs text-red-500"
        >
          {{ settingsError }}
        </p>
        <p
          v-if="settingsSuccess"
          class="text-xs text-green-600"
        >
          {{ settingsSuccess }}
        </p>
      </div>

      <!-- n8n Connection tab -->
      <div
        v-if="activeTab === 'n8n'"
        class="space-y-3"
      >
        <span class="text-sm font-medium text-(--ui-text-highlighted)">n8n Connection</span>
        <p class="text-xs text-(--ui-text-muted)">
          Connect Shop Planr to a self-hosted
          <a
            href="https://n8n.io"
            target="_blank"
            rel="noopener"
            class="text-(--ui-primary) hover:underline"
          >n8n</a>
          instance to deploy webhook automations from the
          <NuxtLink
            to="/webhooks"
            class="text-(--ui-primary) hover:underline"
          >Webhooks page</NuxtLink>.
        </p>
        <div class="p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50">
          <N8nConnectionForm
            :connection="settings?.n8nConnection ?? defaultN8nConnection"
            @save="onSaveN8nConnection"
          />
        </div>
        <p
          v-if="settingsError"
          class="text-xs text-red-500"
        >
          {{ settingsError }}
        </p>
        <p
          v-if="settingsSuccess"
          class="text-xs text-green-600"
        >
          {{ settingsSuccess }}
        </p>
      </div>

      <!-- Libraries tab -->
      <div
        v-if="activeTab === 'libraries'"
        class="space-y-3"
      >
        <span class="text-sm font-medium text-(--ui-text-highlighted)">Process &amp; Location Libraries</span>
        <div class="p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50">
          <LibraryManager />
        </div>
      </div>

      <!-- Tags tab -->
      <div
        v-if="activeTab === 'tags'"
        class="space-y-3"
      >
        <span class="text-sm font-medium text-(--ui-text-highlighted)">Job Tags</span>
        <div class="p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50">
          <TagManager />
        </div>
      </div>

      <!-- Page Visibility tab -->
      <div
        v-if="activeTab === 'pages'"
        class="space-y-3"
      >
        <span class="text-sm font-medium text-(--ui-text-highlighted)">Page Visibility</span>
        <div class="p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50">
          <PageVisibilitySettings
            :toggles="settings?.pageToggles ?? DEFAULT_PAGE_TOGGLES"
            @update="onSaveToggles"
          />
        </div>
        <p
          v-if="settingsError"
          class="text-xs text-red-500"
        >
          {{ settingsError }}
        </p>
        <p
          v-if="settingsSuccess"
          class="text-xs text-green-600"
        >
          {{ settingsSuccess }}
        </p>
      </div>
    </template>
  </div>
</template>
