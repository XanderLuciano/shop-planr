import type { Job } from '../../types/domain'

export interface JobRepository {
  create(job: Job): Job
  getById(id: string): Job | null
  list(): Job[]
  update(id: string, partial: Partial<Job>): Job
  delete(id: string): boolean
}
