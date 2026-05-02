import { ref, readonly } from 'vue'
import type { TemplateRoute, Path } from '~/types/domain'
import type { CreateTemplateInput, ApplyTemplateInput } from '~/types/api'

const templates = ref<TemplateRoute[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useTemplates() {
  const $api = useAuthFetch()

  async function fetchTemplates() {
    loading.value = true
    error.value = null
    try {
      templates.value = await $api<TemplateRoute[]>('/api/templates')
    } catch (e) {
      error.value = extractApiError(e, 'Failed to fetch templates')
      templates.value = []
    } finally {
      loading.value = false
    }
  }

  async function createTemplate(input: CreateTemplateInput): Promise<TemplateRoute> {
    const template = await $api<TemplateRoute>('/api/templates', {
      method: 'POST',
      body: input,
    })
    await fetchTemplates()
    return template
  }

  async function deleteTemplate(id: string): Promise<void> {
    await $api(`/api/templates/${id}`, {
      method: 'DELETE',
    })
    await fetchTemplates()
  }

  async function applyTemplate(templateId: string, input: ApplyTemplateInput): Promise<Path> {
    return await $api<Path>(`/api/templates/${templateId}/apply`, {
      method: 'POST',
      body: input,
    })
  }

  return {
    templates: readonly(templates),
    loading: readonly(loading),
    error: readonly(error),
    fetchTemplates,
    createTemplate,
    deleteTemplate,
    applyTemplate,
  }
}
