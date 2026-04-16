import type Database from 'better-sqlite3'
import { SQLiteTagRepository } from '../../../server/repositories/sqlite/tagRepository'
import { SQLiteJobTagRepository } from '../../../server/repositories/sqlite/jobTagRepository'
import { SQLiteJobRepository } from '../../../server/repositories/sqlite/jobRepository'
import { SQLiteUserRepository } from '../../../server/repositories/sqlite/userRepository'
import { SQLiteAuditRepository } from '../../../server/repositories/sqlite/auditRepository'
import { createAuditService } from '../../../server/services/auditService'
import { createTagService } from '../../../server/services/tagService'

export const ADMIN_ID = 'user_admin_test'

/**
 * Spin up a fully-wired `tagService` against the provided SQLite database.
 *
 * Property tests focus on tag business rules, not admin gating — the
 * admin check is exercised in `tests/unit/services/tagService.test.ts`.
 * This helper seeds an admin user and returns that user's id so tests
 * can pass it without having to re-implement the wiring each time.
 */
export function createTagServiceForTest(db: Database.Database) {
  const tagRepo = new SQLiteTagRepository(db)
  const jobTagRepo = new SQLiteJobTagRepository(db)
  const jobRepo = new SQLiteJobRepository(db)
  const userRepo = new SQLiteUserRepository(db)
  const auditRepo = new SQLiteAuditRepository(db)
  const auditService = createAuditService({ audit: auditRepo })

  userRepo.create({
    id: ADMIN_ID,
    username: 'admin_test',
    displayName: 'Admin Test',
    isAdmin: true,
    active: true,
    pinHash: null,
    createdAt: new Date().toISOString(),
  })

  const tagService = createTagService(
    { tags: tagRepo, jobTags: jobTagRepo, jobs: jobRepo, users: userRepo },
    auditService,
  )

  return { tagService, tagRepo, jobTagRepo, jobRepo, userRepo, auditService, adminId: ADMIN_ID }
}
