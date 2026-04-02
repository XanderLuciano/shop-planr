import type { Job } from '../../types/domain'

export interface JobRepository {
  create(job: Job): Job
  createWithAutoIncPriority(job: Omit<Job, 'priority'>): Job
  getById(id: string): Job | null
  list(): Job[]
  update(id: string, partial: Partial<Job>): Job
  delete(id: string): boolean
  bulkUpdatePriority(entries: { id: string; priority: number }[]): void
}
