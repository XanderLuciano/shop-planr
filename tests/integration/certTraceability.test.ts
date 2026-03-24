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

  it('create certs → attach to serial at step → verify audit entry', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, certService, auditService } = ctx

    const job = jobService.createJob({ name: 'Cert Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'Cut' }, { name: 'Inspect' }]
    })

    const [serial] = serialService.batchCreateSerials(
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
    const attachment = certService.attachCertToSerial({
      certId: matCert.id,
      serialId: serial.id,
      stepId: path.steps[0].id,
      userId: 'qe1',
      jobId: job.id,
      pathId: path.id
    })
    expect(attachment.certId).toBe(matCert.id)
    expect(attachment.serialId).toBe(serial.id)

    // Advance serial, attach process cert at step 1
    serialService.advanceSerial(serial.id, 'operator1')
    certService.attachCertToSerial({
      certId: procCert.id,
      serialId: serial.id,
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

  it('attach cert to multiple serials individually → verify all have cert', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, certService } = ctx

    const job = jobService.createJob({ name: 'Batch Cert Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 5,
      steps: [{ name: 'OP1' }, { name: 'OP2' }]
    })

    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'operator1'
    )

    const cert = certService.createCert({ type: 'material', name: 'Batch Cert' })

    // Attach cert to all 5 serials at their current step
    for (const sn of serials) {
      certService.attachCertToSerial({
        certId: cert.id,
        serialId: sn.id,
        stepId: path.steps[0].id,
        userId: 'qe1',
        jobId: job.id,
        pathId: path.id
      })
    }

    // Verify each serial has the cert
    for (const sn of serials) {
      const attachments = certService.getCertsForSerial(sn.id)
      expect(attachments.length).toBeGreaterThanOrEqual(1)
      expect(attachments.some(a => a.certId === cert.id)).toBe(true)
    }
  })

  it('query serial certs → returns in attachment order', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, certService } = ctx

    const job = jobService.createJob({ name: 'Order Test', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'Step A' }, { name: 'Step B' }, { name: 'Step C' }]
    })

    const [serial] = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'op1'
    )

    const cert1 = certService.createCert({ type: 'material', name: 'First Cert' })
    const cert2 = certService.createCert({ type: 'process', name: 'Second Cert' })
    const cert3 = certService.createCert({ type: 'material', name: 'Third Cert' })

    // Attach in order: cert1 at step 0, advance, cert2 at step 1, advance, cert3 at step 2
    certService.attachCertToSerial({
      certId: cert1.id, serialId: serial.id, stepId: path.steps[0].id, userId: 'qe1'
    })
    serialService.advanceSerial(serial.id, 'op1')
    certService.attachCertToSerial({
      certId: cert2.id, serialId: serial.id, stepId: path.steps[1].id, userId: 'qe1'
    })
    serialService.advanceSerial(serial.id, 'op1')
    certService.attachCertToSerial({
      certId: cert3.id, serialId: serial.id, stepId: path.steps[2].id, userId: 'qe1'
    })

    const certs = certService.getCertsForSerial(serial.id)
    expect(certs).toHaveLength(3)
    expect(certs[0].certId).toBe(cert1.id)
    expect(certs[1].certId).toBe(cert2.id)
    expect(certs[2].certId).toBe(cert3.id)
  })

  it('audit trail is complete for all operations on a serial', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, certService, auditService } = ctx

    const job = jobService.createJob({ name: 'Full Audit Job', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'OP1' }, { name: 'OP2' }]
    })

    const [serial] = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'op1'
    )

    const cert = certService.createCert({ type: 'material', name: 'Audit Cert' })
    certService.attachCertToSerial({
      certId: cert.id, serialId: serial.id, stepId: path.steps[0].id, userId: 'qe1'
    })
    serialService.advanceSerial(serial.id, 'op1')
    serialService.advanceSerial(serial.id, 'op1') // completes

    // Query audit trail for this serial
    const trail = auditService.getSerialAuditTrail(serial.id)

    // Should have: cert_attached + serial_advanced + serial_completed = 3
    // (serial_created is per-batch, not per-serial, so it may not appear in serial trail)
    const actions = trail.map(e => e.action)
    expect(actions).toContain('cert_attached')
    expect(actions).toContain('serial_advanced')
    expect(actions).toContain('serial_completed')

    // Entries are in chronological order
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i].timestamp >= trail[i - 1].timestamp).toBe(true)
    }
  })

  it('rejects attaching a non-existent cert', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, certService } = ctx

    const job = jobService.createJob({ name: 'Bad Cert Job', goalQuantity: 1 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 1,
      steps: [{ name: 'OP1' }]
    })
    const [serial] = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 1 },
      'op1'
    )

    expect(() => certService.attachCertToSerial({
      certId: 'nonexistent-cert',
      serialId: serial.id,
      stepId: path.steps[0].id,
      userId: 'qe1'
    })).toThrow(/not found/i)
  })
})
