/**
 * Integration: Certificate Traceability
 *
 * Attach certs → batch attach → verify audit trail.
 * Validates: Requirements 5.1–5.6, 13.1–13.5
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Certificate Traceability Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('create certs → attach to part at step → verify audit entry', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, certService, auditService } = ctx

    const job = jobService.createJob({ name: 'Cert Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'Cut' }, { name: 'Inspect' }]
    })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'operator1'
    )

    // Create material and process certs
    const matCert = certService.createCert({
      type: 'material',
      name: 'Steel 4140 Cert',
      metadata: { grade: '4140', heatLot: 'HL-001' }
    })
    const procCert = certService.createCert({
      type: 'process',
      name: 'Heat Treat Cert'
    })

    expect(matCert.type).toBe('material')
    expect(procCert.type).toBe('process')

    // Attach material cert at step 0
    const attachment = certService.attachCertToPart({
      certId: matCert.id,
      partId: part.id,
      stepId: path.steps[0].id,
      userId: 'qe1',
      jobId: job.id,
      pathId: path.id
    })
    expect(attachment.certId).toBe(matCert.id)
    expect(attachment.partId).toBe(part.id)

    // Advance part, attach process cert at step 1
    partService.advancePart(part.id, 'operator1')
    certService.attachCertToPart({
      certId: procCert.id,
      partId: part.id,
      stepId: path.steps[1].id,
      userId: 'qe1',
      jobId: job.id,
      pathId: path.id
    })

    // Verify audit trail has cert attachment entries
    const auditEntries = auditService.listAuditEntries({ limit: 100 })
    const certAudits = auditEntries.filter(a => a.action === 'cert_attached')
    expect(certAudits).toHaveLength(2)
    const certIds = certAudits.map(a => a.certId)
    expect(certIds).toContain(matCert.id)
    expect(certIds).toContain(procCert.id)
    // All cert audits were performed by qe1
    for (const audit of certAudits) {
      expect(audit.userId).toBe('qe1')
    }
  })

  it('attach cert to multiple parts individually → verify all have cert', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, certService } = ctx

    const job = jobService.createJob({ name: 'Batch Cert Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'OP1' }, { name: 'OP2' }]
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'operator1'
    )

    const cert = certService.createCert({ type: 'material', name: 'Batch Cert' })

    // Attach cert to all 5 parts at their current step
    for (const part of parts) {
      certService.attachCertToPart({
        certId: cert.id,
        partId: part.id,
        stepId: path.steps[0].id,
        userId: 'qe1',
        jobId: job.id,
        pathId: path.id
      })
    }

    // Verify each part has the cert
    for (const part of parts) {
      const attachments = certService.getCertsForPart(part.id)
      expect(attachments.length).toBeGreaterThanOrEqual(1)
      expect(attachments.some(a => a.certId === cert.id)).toBe(true)
    }
  })

  it('query part certs → returns in attachment order', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, certService } = ctx

    const job = jobService.createJob({ name: 'Order Test', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'Step A' }, { name: 'Step B' }, { name: 'Step C' }]
    })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'op1'
    )

    const cert1 = certService.createCert({ type: 'material', name: 'First Cert' })
    const cert2 = certService.createCert({ type: 'process', name: 'Second Cert' })
    const cert3 = certService.createCert({ type: 'material', name: 'Third Cert' })

    // Attach in order: cert1 at step 0, advance, cert2 at step 1, advance, cert3 at step 2
    certService.attachCertToPart({
      certId: cert1.id, partId: part.id, stepId: path.steps[0].id, userId: 'qe1'
    })
    partService.advancePart(part.id, 'op1')
    certService.attachCertToPart({
      certId: cert2.id, partId: part.id, stepId: path.steps[1].id, userId: 'qe1'
    })
    partService.advancePart(part.id, 'op1')
    certService.attachCertToPart({
      certId: cert3.id, partId: part.id, stepId: path.steps[2].id, userId: 'qe1'
    })

    const certs = certService.getCertsForPart(part.id)
    expect(certs).toHaveLength(3)
    expect(certs[0].certId).toBe(cert1.id)
    expect(certs[1].certId).toBe(cert2.id)
    expect(certs[2].certId).toBe(cert3.id)
  })

  it('audit trail is complete for all operations on a part', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, certService, auditService } = ctx

    const job = jobService.createJob({ name: 'Full Audit Job', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'OP1' }, { name: 'OP2' }]
    })

    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'op1'
    )

    const cert = certService.createCert({ type: 'material', name: 'Audit Cert' })
    certService.attachCertToPart({
      certId: cert.id, partId: part.id, stepId: path.steps[0].id, userId: 'qe1'
    })
    partService.advancePart(part.id, 'op1')
    partService.advancePart(part.id, 'op1') // completes

    // Query audit trail for this part
    const trail = auditService.getPartAuditTrail(part.id)

    // Should have: cert_attached + part_advanced + part_completed = 3
    // (part_created is per-batch, not per-part, so it may not appear in part trail)
    const actions = trail.map(e => e.action)
    expect(actions).toContain('cert_attached')
    expect(actions).toContain('part_advanced')
    expect(actions).toContain('part_completed')

    // Entries are in chronological order
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i].timestamp >= trail[i - 1].timestamp).toBe(true)
    }
  })

  it('rejects attaching a non-existent cert', () => {
    ctx = createTestContext()
    const { jobService, pathService, partService, certService } = ctx

    const job = jobService.createJob({ name: 'Bad Cert Job', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'OP1' }]
    })
    const [part] = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'op1'
    )

    expect(() => certService.attachCertToPart({
      certId: 'nonexistent-cert',
      partId: part.id,
      stepId: path.steps[0].id,
      userId: 'qe1'
    })).toThrow(/not found/i)
  })
})
