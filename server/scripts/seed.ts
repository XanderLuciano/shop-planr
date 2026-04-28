/**
 * Dev seed data script for SHOP_ERP.
 *
 * Creates SAMPLE- prefixed data for development and demo purposes.
 * Focused on CNC machine shop workflows: machining, coatings, heat treat, inspection.
 *
 * Idempotent: checks for existing SAMPLE- data before creating.
 *
 * Usage:
 *   npx tsx server/scripts/seed.ts          # Seed (idempotent)
 *   npx tsx server/scripts/seed.ts --reset   # Delete SAMPLE- data + re-seed
 */
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { runMigrations } from '../repositories/sqlite/index'
import { SQLiteJobRepository } from '../repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../repositories/sqlite/pathRepository'
import { SQLitePartRepository } from '../repositories/sqlite/partRepository'
import { SQLiteCertRepository } from '../repositories/sqlite/certRepository'
import { SQLiteTemplateRepository } from '../repositories/sqlite/templateRepository'
import { SQLiteAuditRepository } from '../repositories/sqlite/auditRepository'
import { SQLiteNoteRepository } from '../repositories/sqlite/noteRepository'
import { SQLiteUserRepository } from '../repositories/sqlite/userRepository'
import { SQLiteLibraryRepository } from '../repositories/sqlite/libraryRepository'
import { createJobService } from '../services/jobService'
import { createPathService } from '../services/pathService'
import { createPartService } from '../services/partService'
import { createCertService } from '../services/certService'
import { createTemplateService } from '../services/templateService'
import { createAuditService } from '../services/auditService'
import { createNoteService } from '../services/noteService'
import { createUserService } from '../services/userService'
import { createLibraryService } from '../services/libraryService'
import { createSequentialPartIdGenerator } from '../utils/idGenerator'

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../repositories/sqlite/migrations')

function openDatabase(dbPath: string): Database.Database {
  const dir = resolve(dbPath, '..')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, MIGRATIONS_DIR)
  return db
}

function createServices(db: Database.Database) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    parts: new SQLitePartRepository(db),
    certs: new SQLiteCertRepository(db),
    templates: new SQLiteTemplateRepository(db),
    audit: new SQLiteAuditRepository(db),
    notes: new SQLiteNoteRepository(db),
    users: new SQLiteUserRepository(db),
    library: new SQLiteLibraryRepository(db),
  }

  const partIdGenerator = createSequentialPartIdGenerator({
    getCounter: () => {
      const row = db.prepare('SELECT value FROM counters WHERE name = ?').get('part') as { value: number } | undefined
      return row?.value ?? 0
    },
    setCounter: (v: number) => {
      db.prepare('INSERT OR REPLACE INTO counters (name, value) VALUES (?, ?)').run('part', v)
    },
  })

  const auditService = createAuditService({ audit: repos.audit })
  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, parts: repos.parts })
  const pathService = createPathService({ paths: repos.paths, parts: repos.parts })
  const partService = createPartService(
    { parts: repos.parts, paths: repos.paths, certs: repos.certs },
    auditService,
    partIdGenerator,
  )
  const certService = createCertService({ certs: repos.certs, parts: repos.parts, paths: repos.paths }, auditService)
  const templateService = createTemplateService({ templates: repos.templates, paths: repos.paths })
  const noteService = createNoteService({ notes: repos.notes }, auditService)
  const userService = createUserService({ users: repos.users })
  const libraryService = createLibraryService({ library: repos.library })

  return { jobService, pathService, partService, certService, templateService, noteService, userService, libraryService }
}

function hasSampleData(db: Database.Database): boolean {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM jobs WHERE name LIKE \'SAMPLE-%\'').get() as { cnt: number }
  return row.cnt > 0
}

export function seedDatabase(dbPath: string): void {
  const db = openDatabase(dbPath)

  try {
    if (hasSampleData(db)) {
      console.log('Seed data already exists, skipping')
      return
    }

    const svc = createServices(db)
    console.log('Creating SAMPLE- seed data...')

    // ── Process Library ──
    // Core CNC shop processes — these populate the dropdowns in template/path editors
    const processes = [
      'CNC Machine', 'Stress Relief', 'Heat Treat', 'Chemfilm', 'Anodize',
      'Hard Anodize', 'Passivate', 'Inspection', 'Deburr', 'Clean',
      'Laser Engrave', 'Bead Blast',
    ]
    for (const name of processes) {
      try {
        svc.libraryService.addProcess(name)
      } catch { /* already exists */ }
    }
    console.log(`  Process library: ${processes.length} entries`)

    // ── Location Library ──
    const locations = [
      'CNC Department', 'QC Lab', 'Deburr Station', 'Vendor - Anodize Co.',
      'Vendor - HeatTreat Inc.', 'Vendor - Chemfilm Services', 'Shipping', 'Laser Room',
    ]
    for (const name of locations) {
      try {
        svc.libraryService.addLocation(name)
      } catch { /* already exists */ }
    }
    console.log(`  Location library: ${locations.length} entries`)

    // ── Templates ──
    // 1) Basic: CNC → Inspection
    const tmplBasic = svc.templateService.createTemplate({
      name: 'SAMPLE-CNC Basic',
      steps: [
        { name: 'CNC Machine', location: 'CNC Department' },
        { name: 'Deburr', location: 'Deburr Station' },
        { name: 'Inspection', location: 'QC Lab' },
      ],
    })
    console.log(`  Template: ${tmplBasic.name}`)

    // 2) With chemfilm coating
    const tmplChemfilm = svc.templateService.createTemplate({
      name: 'SAMPLE-CNC + Chemfilm',
      steps: [
        { name: 'CNC Machine', location: 'CNC Department' },
        { name: 'Deburr', location: 'Deburr Station' },
        { name: 'Inspection', location: 'QC Lab' },
        { name: 'Chemfilm', location: 'Vendor - Chemfilm Services' },
        { name: 'Final Inspection', location: 'QC Lab' },
      ],
    })
    console.log(`  Template: ${tmplChemfilm.name}`)

    // 3) With hard anodize — stress relief after rough machining
    const tmplHardAnodize = svc.templateService.createTemplate({
      name: 'SAMPLE-CNC + Hard Anodize',
      steps: [
        { name: 'CNC Machine', location: 'CNC Department' },
        { name: 'Stress Relief', location: 'Vendor - HeatTreat Inc.' },
        { name: 'CNC Machine', location: 'CNC Department' },
        { name: 'Deburr', location: 'Deburr Station' },
        { name: 'Inspection', location: 'QC Lab' },
        { name: 'Hard Anodize', location: 'Vendor - Anodize Co.' },
        { name: 'Final Inspection', location: 'QC Lab' },
      ],
    })
    console.log(`  Template: ${tmplHardAnodize.name}`)

    // 4) Steel parts — heat treat + passivate
    const tmplSteelPassivate = svc.templateService.createTemplate({
      name: 'SAMPLE-CNC Steel + Passivate',
      steps: [
        { name: 'CNC Machine', location: 'CNC Department' },
        { name: 'Heat Treat', location: 'Vendor - HeatTreat Inc.' },
        { name: 'CNC Machine', location: 'CNC Department' },
        { name: 'Deburr', location: 'Deburr Station' },
        { name: 'Inspection', location: 'QC Lab' },
        { name: 'Passivate', location: 'Vendor - Chemfilm Services' },
        { name: 'Final Inspection', location: 'QC Lab' },
      ],
    })
    console.log(`  Template: ${tmplSteelPassivate.name}`)

    // 5) Simple anodize (Type II)
    const tmplAnodize = svc.templateService.createTemplate({
      name: 'SAMPLE-CNC + Anodize',
      steps: [
        { name: 'CNC Machine', location: 'CNC Department' },
        { name: 'Deburr', location: 'Deburr Station' },
        { name: 'Bead Blast', location: 'Deburr Station' },
        { name: 'Inspection', location: 'QC Lab' },
        { name: 'Anodize', location: 'Vendor - Anodize Co.' },
        { name: 'Final Inspection', location: 'QC Lab' },
      ],
    })
    console.log(`  Template: ${tmplAnodize.name}`)

    // ── Users ──
    const mike = svc.userService.createUser({ username: 'SAMPLE-Mike', displayName: 'SAMPLE-Mike', department: 'CNC Department' })
    const sarah = svc.userService.createUser({ username: 'SAMPLE-Sarah', displayName: 'SAMPLE-Sarah', department: 'QC', isAdmin: true })
    const tony = svc.userService.createUser({ username: 'SAMPLE-Tony', displayName: 'SAMPLE-Tony', department: 'CNC Department' })
    const lisa = svc.userService.createUser({ username: 'SAMPLE-Lisa', displayName: 'SAMPLE-Lisa', department: 'Deburr / Finishing' })
    console.log(`  Users: ${mike.displayName}, ${sarah.displayName}, ${tony.displayName}, ${lisa.displayName}`)

    // ── Certificates ──
    const certAluminum6061 = svc.certService.createCert({
      type: 'material',
      name: 'SAMPLE-Aluminum 6061-T6 Cert',
      metadata: { grade: '6061-T6', supplier: 'AlumSupply Inc.', lotNumber: 'L-2025-0447', spec: 'AMS-QQ-A-250/11' },
    })
    const certAluminum7075 = svc.certService.createCert({
      type: 'material',
      name: 'SAMPLE-Aluminum 7075-T6 Cert',
      metadata: { grade: '7075-T651', supplier: 'AlumSupply Inc.', lotNumber: 'L-2025-0892', spec: 'AMS-QQ-A-250/12' },
    })
    const certSteel4140 = svc.certService.createCert({
      type: 'material',
      name: 'SAMPLE-Steel 4140 Cert',
      metadata: { grade: '4140', supplier: 'MetalCo', heatNumber: 'H-2025-0451', spec: 'AMS 6382' },
    })
    const certSteel303 = svc.certService.createCert({
      type: 'material',
      name: 'SAMPLE-Stainless 303 Cert',
      metadata: { grade: '303', supplier: 'MetalCo', heatNumber: 'H-2025-1033', spec: 'AMS 5640' },
    })
    const certHeatTreat = svc.certService.createCert({
      type: 'process',
      name: 'SAMPLE-Heat Treat Cert',
      metadata: { vendor: 'HeatTreat Inc.', process: 'Quench & Temper', spec: 'AMS 2759', hardness: 'Rc 28-32' },
    })
    const _certHardAnodize = svc.certService.createCert({
      type: 'process',
      name: 'SAMPLE-Hard Anodize Cert',
      metadata: { vendor: 'Anodize Co.', process: 'Type III Hard Anodize', spec: 'MIL-A-8625 Type III', thickness: '0.002"' },
    })
    const certChemfilm = svc.certService.createCert({
      type: 'process',
      name: 'SAMPLE-Chemfilm Cert',
      metadata: { vendor: 'Chemfilm Services', process: 'Chromate Conversion', spec: 'MIL-DTL-5541 Class 1A' },
    })
    const certPassivate = svc.certService.createCert({
      type: 'process',
      name: 'SAMPLE-Passivation Cert',
      metadata: { vendor: 'Chemfilm Services', process: 'Citric Acid Passivation', spec: 'ASTM A967 / AMS 2700' },
    })
    const certAnodize = svc.certService.createCert({
      type: 'process',
      name: 'SAMPLE-Anodize Type II Cert',
      metadata: { vendor: 'Anodize Co.', process: 'Type II Anodize', spec: 'MIL-A-8625 Type II', color: 'Black' },
    })
    console.log('  Certificates: 9 created (4 material, 5 process)')

    // ══════════════════════════════════════════════════════════════════
    // Job 1: Mounting Bracket — simple CNC + Chemfilm, aluminum
    // 25 qty, good progress, some completed
    // ══════════════════════════════════════════════════════════════════
    const job1 = svc.jobService.createJob({ name: 'SAMPLE-Mounting Bracket', goalQuantity: 25 })
    const path1 = svc.templateService.applyTemplate(tmplChemfilm.id, {
      jobId: job1.id,
      pathName: 'CNC + Chemfilm',
      goalQuantity: 25,
    })
    const j1parts = svc.partService.batchCreateParts(
      { jobId: job1.id, pathId: path1.id, quantity: 20, certId: certAluminum6061.id },
      mike.id,
    )
    // Advance 16 past CNC Machine (step 0 → 1)
    for (let i = 0; i < 16; i++) svc.partService.advancePart(j1parts[i]!.id, mike.id)
    // Advance 12 past Deburr (step 1 → 2)
    for (let i = 0; i < 12; i++) svc.partService.advancePart(j1parts[i]!.id, lisa.id)
    // Advance 10 past Inspection (step 2 → 3)
    for (let i = 0; i < 10; i++) svc.partService.advancePart(j1parts[i]!.id, sarah.id)
    // Advance 8 past Chemfilm (step 3 → 4)
    for (let i = 0; i < 8; i++) svc.partService.advancePart(j1parts[i]!.id, sarah.id)
    // Complete 5 (past Final Inspection)
    for (let i = 0; i < 5; i++) svc.partService.advancePart(j1parts[i]!.id, sarah.id)
    // Attach chemfilm cert to the 8 that went through chemfilm
    for (let i = 0; i < 8; i++) {
      svc.certService.attachCertToSerial({
        certId: certChemfilm.id, serialId: j1parts[i]!.id,
        stepId: path1.steps[3]!.id, userId: sarah.id,
        jobId: job1.id, pathId: path1.id,
      })
    }
    // Note on deburr step
    svc.noteService.createNote({
      jobId: job1.id, pathId: path1.id, stepId: path1.steps[1]!.id,
      partIds: [j1parts[13]!.id, j1parts[14]!.id],
      text: 'Sharp edge on pocket corner — needs extra deburr pass',
      userId: lisa.id,
    })
    console.log(`  Job: ${job1.name} — 20 parts (5 done, 3 at Final Insp, 2 at Chemfilm, 2 at Insp, 4 at Deburr, 4 at CNC)`)

    // ══════════════════════════════════════════════════════════════════
    // Job 2: Actuator Housing — complex hard anodize path, 7075 aluminum
    // 10 qty, early-mid progress
    // ══════════════════════════════════════════════════════════════════
    const job2 = svc.jobService.createJob({ name: 'SAMPLE-Actuator Housing', goalQuantity: 10 })
    const path2 = svc.templateService.applyTemplate(tmplHardAnodize.id, {
      jobId: job2.id,
      pathName: 'CNC + Hard Anodize',
      goalQuantity: 10,
    })
    const j2parts = svc.partService.batchCreateParts(
      { jobId: job2.id, pathId: path2.id, quantity: 10, certId: certAluminum7075.id },
      tony.id,
    )
    // Steps: 0=CNC, 1=Stress Relief, 2=CNC, 3=Deburr, 4=Inspection, 5=Hard Anodize, 6=Final Insp
    // Advance 8 past first CNC (step 0 → 1)
    for (let i = 0; i < 8; i++) svc.partService.advancePart(j2parts[i]!.id, tony.id)
    // Advance 6 past Stress Relief (step 1 → 2)
    for (let i = 0; i < 6; i++) svc.partService.advancePart(j2parts[i]!.id, tony.id)
    // Advance 4 past second CNC (step 2 → 3)
    for (let i = 0; i < 4; i++) svc.partService.advancePart(j2parts[i]!.id, tony.id)
    // Advance 3 past Deburr (step 3 → 4)
    for (let i = 0; i < 3; i++) svc.partService.advancePart(j2parts[i]!.id, lisa.id)
    // Advance 2 past Inspection (step 4 → 5)
    for (let i = 0; i < 2; i++) svc.partService.advancePart(j2parts[i]!.id, sarah.id)
    // Note about stress relief vendor delay
    svc.noteService.createNote({
      jobId: job2.id, pathId: path2.id, stepId: path2.steps[1]!.id,
      partIds: [j2parts[6]!.id, j2parts[7]!.id],
      text: 'Vendor batch delayed — expected back Thursday',
      userId: tony.id,
    })
    console.log(`  Job: ${job2.name} — 10 parts (0 done, 2 at Hard Anodize, 1 at Insp, 1 at Deburr, 2 at CNC2, 2 at Stress Relief, 2 at CNC1)`)

    // ══════════════════════════════════════════════════════════════════
    // Job 3: Valve Body — steel, heat treat + passivate, 2 paths
    // 50 qty, good spread across both paths
    // ══════════════════════════════════════════════════════════════════
    const job3 = svc.jobService.createJob({ name: 'SAMPLE-Valve Body', goalQuantity: 50 })

    // Path A: Steel + Passivate (main run, 30 qty)
    const path3a = svc.templateService.applyTemplate(tmplSteelPassivate.id, {
      jobId: job3.id,
      pathName: 'Steel + Passivate',
      goalQuantity: 30,
    })
    const j3aParts = svc.partService.batchCreateParts(
      { jobId: job3.id, pathId: path3a.id, quantity: 25, certId: certSteel4140.id },
      mike.id,
    )
    // Steps: 0=CNC, 1=Heat Treat, 2=CNC, 3=Deburr, 4=Inspection, 5=Passivate, 6=Final Insp
    // Advance 20 past CNC (step 0 → 1)
    for (let i = 0; i < 20; i++) svc.partService.advancePart(j3aParts[i]!.id, mike.id)
    // Advance 15 past Heat Treat (step 1 → 2)
    for (let i = 0; i < 15; i++) svc.partService.advancePart(j3aParts[i]!.id, mike.id)
    // Attach heat treat cert to the 15 that went through
    for (let i = 0; i < 15; i++) {
      svc.certService.attachCertToSerial({
        certId: certHeatTreat.id, serialId: j3aParts[i]!.id,
        stepId: path3a.steps[1]!.id, userId: mike.id,
        jobId: job3.id, pathId: path3a.id,
      })
    }
    // Advance 10 past second CNC (step 2 → 3)
    for (let i = 0; i < 10; i++) svc.partService.advancePart(j3aParts[i]!.id, mike.id)
    // Advance 8 past Deburr (step 3 → 4)
    for (let i = 0; i < 8; i++) svc.partService.advancePart(j3aParts[i]!.id, lisa.id)
    // Advance 6 past Inspection (step 4 → 5)
    for (let i = 0; i < 6; i++) svc.partService.advancePart(j3aParts[i]!.id, sarah.id)
    // Advance 4 past Passivate (step 5 → 6)
    for (let i = 0; i < 4; i++) svc.partService.advancePart(j3aParts[i]!.id, sarah.id)
    // Attach passivation cert
    for (let i = 0; i < 4; i++) {
      svc.certService.attachCertToSerial({
        certId: certPassivate.id, serialId: j3aParts[i]!.id,
        stepId: path3a.steps[5]!.id, userId: sarah.id,
        jobId: job3.id, pathId: path3a.id,
      })
    }
    // Complete 2
    for (let i = 0; i < 2; i++) svc.partService.advancePart(j3aParts[i]!.id, sarah.id)

    // Path B: Basic CNC path for simpler variant (20 qty)
    const path3b = svc.templateService.applyTemplate(tmplBasic.id, {
      jobId: job3.id,
      pathName: 'Basic CNC (no coating)',
      goalQuantity: 20,
    })
    const j3bParts = svc.partService.batchCreateParts(
      { jobId: job3.id, pathId: path3b.id, quantity: 15, certId: certSteel4140.id },
      tony.id,
    )
    // Steps: 0=CNC, 1=Deburr, 2=Inspection
    for (let i = 0; i < 12; i++) svc.partService.advancePart(j3bParts[i]!.id, tony.id)
    for (let i = 0; i < 8; i++) svc.partService.advancePart(j3bParts[i]!.id, lisa.id)
    for (let i = 0; i < 5; i++) svc.partService.advancePart(j3bParts[i]!.id, sarah.id)

    svc.noteService.createNote({
      jobId: job3.id, pathId: path3a.id, stepId: path3a.steps[4]!.id,
      partIds: [j3aParts[7]!.id],
      text: 'OD dimension at high end of tolerance — flagged for review',
      userId: sarah.id,
    })
    console.log(`  Job: ${job3.name} — 40 parts across 2 paths (7 completed total)`)

    // ══════════════════════════════════════════════════════════════════
    // Job 4: Sensor Cover — anodize (Type II), small batch
    // 15 qty, nearly complete
    // ══════════════════════════════════════════════════════════════════
    const job4 = svc.jobService.createJob({ name: 'SAMPLE-Sensor Cover', goalQuantity: 15 })
    const path4 = svc.templateService.applyTemplate(tmplAnodize.id, {
      jobId: job4.id,
      pathName: 'CNC + Anodize',
      goalQuantity: 15,
    })
    const j4parts = svc.partService.batchCreateParts(
      { jobId: job4.id, pathId: path4.id, quantity: 15, certId: certAluminum6061.id },
      mike.id,
    )
    // Steps: 0=CNC, 1=Deburr, 2=Bead Blast, 3=Inspection, 4=Anodize, 5=Final Insp
    // All 15 past CNC
    for (let i = 0; i < 15; i++) svc.partService.advancePart(j4parts[i]!.id, mike.id)
    // 14 past Deburr
    for (let i = 0; i < 14; i++) svc.partService.advancePart(j4parts[i]!.id, lisa.id)
    // 13 past Bead Blast
    for (let i = 0; i < 13; i++) svc.partService.advancePart(j4parts[i]!.id, lisa.id)
    // 12 past Inspection
    for (let i = 0; i < 12; i++) svc.partService.advancePart(j4parts[i]!.id, sarah.id)
    // 10 past Anodize
    for (let i = 0; i < 10; i++) svc.partService.advancePart(j4parts[i]!.id, sarah.id)
    // Attach anodize cert
    for (let i = 0; i < 10; i++) {
      svc.certService.attachCertToSerial({
        certId: certAnodize.id, serialId: j4parts[i]!.id,
        stepId: path4.steps[4]!.id, userId: sarah.id,
        jobId: job4.id, pathId: path4.id,
      })
    }
    // Complete 8
    for (let i = 0; i < 8; i++) svc.partService.advancePart(j4parts[i]!.id, sarah.id)
    console.log(`  Job: ${job4.name} — 15 parts (8 done, 2 at Final Insp, 2 at Anodize, 1 at Insp, 1 at Bead Blast, 1 at Deburr)`)

    // ══════════════════════════════════════════════════════════════════
    // Job 5: Connector Pin — stainless 303, passivate, high volume
    // 100 qty, early stage
    // ══════════════════════════════════════════════════════════════════
    const job5 = svc.jobService.createJob({ name: 'SAMPLE-Connector Pin', goalQuantity: 100 })
    const path5 = svc.pathService.createPath({
      jobId: job5.id,
      name: 'CNC + Passivate',
      goalQuantity: 100,
      steps: [
        { name: 'CNC Machine', location: 'CNC Department' },
        { name: 'Deburr', location: 'Deburr Station' },
        { name: 'Inspection', location: 'QC Lab' },
        { name: 'Passivate', location: 'Vendor - Chemfilm Services' },
        { name: 'Final Inspection', location: 'QC Lab' },
      ],
    })
    const j5parts = svc.partService.batchCreateParts(
      { jobId: job5.id, pathId: path5.id, quantity: 30, certId: certSteel303.id },
      tony.id,
    )
    // Steps: 0=CNC, 1=Deburr, 2=Inspection, 3=Passivate, 4=Final Insp
    // 20 past CNC
    for (let i = 0; i < 20; i++) svc.partService.advancePart(j5parts[i]!.id, tony.id)
    // 12 past Deburr
    for (let i = 0; i < 12; i++) svc.partService.advancePart(j5parts[i]!.id, lisa.id)
    // 5 past Inspection
    for (let i = 0; i < 5; i++) svc.partService.advancePart(j5parts[i]!.id, sarah.id)

    svc.noteService.createNote({
      jobId: job5.id, pathId: path5.id, stepId: path5.steps[0]!.id,
      partIds: [j5parts[22]!.id, j5parts[23]!.id, j5parts[24]!.id],
      text: 'Tool wear detected on lathe — replaced insert, re-verify dimensions on these parts',
      userId: tony.id,
    })
    console.log(`  Job: ${job5.name} — 30 parts (0 done, 5 at Passivate, 7 at Insp, 8 at Deburr, 10 at CNC)`)

    console.log('\nSeed data created successfully!')
  } finally {
    db.close()
  }
}

export function resetDatabase(dbPath: string): void {
  const db = openDatabase(dbPath)

  try {
    console.log('Deleting all SAMPLE- prefixed data...')

    // Find SAMPLE- job IDs for cascading deletes
    const sampleJobIds = (db.prepare('SELECT id FROM jobs WHERE name LIKE \'SAMPLE-%\'').all() as { id: string }[])
      .map(r => r.id)

    if (sampleJobIds.length > 0) {
      const jobPlaceholders = sampleJobIds.map(() => '?').join(',')

      // Find SAMPLE- part IDs (for cert_attachments cleanup)
      const samplePartIds = (db.prepare(`SELECT id FROM parts WHERE job_id IN (${jobPlaceholders})`).all(...sampleJobIds) as { id: string }[])
        .map(r => r.id)

      // Find SAMPLE- path IDs (for process_steps cleanup)
      const samplePathIds = (db.prepare(`SELECT id FROM paths WHERE job_id IN (${jobPlaceholders})`).all(...sampleJobIds) as { id: string }[])
        .map(r => r.id)

      db.transaction(() => {
        // Delete step_notes for SAMPLE jobs
        db.prepare(`DELETE FROM step_notes WHERE job_id IN (${jobPlaceholders})`).run(...sampleJobIds)

        // Delete cert_attachments, part_step_statuses, part_step_overrides for SAMPLE parts
        if (samplePartIds.length > 0) {
          const partPlaceholders = samplePartIds.map(() => '?').join(',')
          db.prepare(`DELETE FROM cert_attachments WHERE part_id IN (${partPlaceholders})`).run(...samplePartIds)
          db.prepare(`DELETE FROM part_step_statuses WHERE part_id IN (${partPlaceholders})`).run(...samplePartIds)
          db.prepare(`DELETE FROM part_step_overrides WHERE part_id IN (${partPlaceholders})`).run(...samplePartIds)
        }

        // Delete audit_entries for SAMPLE jobs
        db.prepare(`DELETE FROM audit_entries WHERE job_id IN (${jobPlaceholders})`).run(...sampleJobIds)

        // Delete parts for SAMPLE jobs
        db.prepare(`DELETE FROM parts WHERE job_id IN (${jobPlaceholders})`).run(...sampleJobIds)

        // Delete process_steps for SAMPLE paths
        if (samplePathIds.length > 0) {
          const pathPlaceholders = samplePathIds.map(() => '?').join(',')
          db.prepare(`DELETE FROM process_steps WHERE path_id IN (${pathPlaceholders})`).run(...samplePathIds)
        }

        // Delete paths for SAMPLE jobs
        db.prepare(`DELETE FROM paths WHERE job_id IN (${jobPlaceholders})`).run(...sampleJobIds)

        // Delete bom_contributing_jobs referencing SAMPLE jobs
        db.prepare(`DELETE FROM bom_contributing_jobs WHERE job_id IN (${jobPlaceholders})`).run(...sampleJobIds)

        // Delete SAMPLE jobs
        db.prepare(`DELETE FROM jobs WHERE name LIKE 'SAMPLE-%'`).run()

        // Delete SAMPLE templates (template_steps cascade via ON DELETE CASCADE)
        db.prepare(`DELETE FROM templates WHERE name LIKE 'SAMPLE-%'`).run()

        // Delete SAMPLE certs
        db.prepare(`DELETE FROM certs WHERE name LIKE 'SAMPLE-%'`).run()

        // Delete SAMPLE users
        db.prepare(`DELETE FROM users WHERE username LIKE 'SAMPLE-%'`).run()
      })()

      console.log(`  Deleted ${sampleJobIds.length} jobs, ${samplePartIds.length} parts, ${samplePathIds.length} paths`)
    } else {
      console.log('  No SAMPLE- data found to delete')
    }
  } finally {
    db.close()
  }

  // Re-seed
  seedDatabase(dbPath)
}

// ── CLI entry point ──
const args = process.argv.slice(2)
const isReset = args.includes('--reset')
const dbPath = resolve(process.cwd(), args.find(a => !a.startsWith('--')) ?? './data/shop_erp.db')

console.log(`Database: ${dbPath}`)
console.log(`Mode: ${isReset ? 'reset + seed' : 'seed (idempotent)'}`)
console.log()

if (isReset) {
  resetDatabase(dbPath)
} else {
  seedDatabase(dbPath)
}
