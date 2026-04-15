import type { Tag } from '../../types/domain'

export interface JobTagRepository {
  getTagsByJobId(jobId: string): Tag[]
  getTagsForJobs(jobIds: string[]): Map<string, Tag[]>
  replaceJobTags(jobId: string, tagIds: string[]): void
  removeAllTagsForJob(jobId: string): void
  countJobsByTagId(tagId: string): number
  getJobIdsByTagId(tagId: string): string[]
}
