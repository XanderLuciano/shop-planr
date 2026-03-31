import { ref, readonly } from 'vue'
import type { Job } from '~/types/domain'
import type { JobProgress } from '~/types/computed'
import type { CreateJobInput, UpdateJobInput } from '~/types/api'

const jobs = ref<Job[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useJobs() {
  async function fetchJobs() {
    loading.value = true
    error.value = null
    try {
      jobs.value = await $fetch<Job[]>('/api/jobs')
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch jobs'
      jobs.value = []
    } finally {
      loading.value = false
    }
  }

  async function createJob(input: CreateJobInput): Promise<Job> {
    const job = await $fetch<Job>('/api/jobs', {
      method: 'POST',
      body: input
    })
    await fetchJobs()
    return job
  }

  async function updateJob(id: string, input: UpdateJobInput): Promise<Job> {
    const job = await $fetch<Job>(`/api/jobs/${id}`, {
      method: 'PUT',
      body: input
    })
    await fetchJobs()
    return job
  }

  async function getJob(id: string): Promise<Job & { progress: JobProgress }> {
    return await $fetch(`/api/jobs/${id}`)
  }

  async function fetchJobProgress(id: string): Promise<JobProgress> {
    const detail = await $fetch<{ progress: JobProgress }>(`/api/jobs/${id}`)
    return detail.progress
  }

  async function deleteJob(id: string): Promise<void> {
    await $fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    await fetchJobs()
  }

  return {
    jobs: readonly(jobs),
    loading: readonly(loading),
    error: readonly(error),
    fetchJobs,
    createJob,
    updateJob,
    getJob,
    fetchJobProgress,
    deleteJob
  }
}
