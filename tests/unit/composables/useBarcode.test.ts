import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectScanType } from '~/app/composables/useBarcode'

describe('detectScanType', () => {
  it('detects parts starting with SN- or part_', () => {
    expect(detectScanType('SN-00001')).toBe('part')
    expect(detectScanType('SN-99999')).toBe('part')
    expect(detectScanType('SN-')).toBe('part')
    expect(detectScanType('part_00001')).toBe('part')
    expect(detectScanType('part_')).toBe('part')
  })

  it('detects certificates starting with cert_', () => {
    expect(detectScanType('cert_abc123')).toBe('certificate')
    expect(detectScanType('cert_')).toBe('certificate')
    expect(detectScanType('cert_material_steel')).toBe('certificate')
  })

  it('returns unknown for other values', () => {
    expect(detectScanType('ABC123')).toBe('unknown')
    expect(detectScanType('sn-00001')).toBe('unknown') // case-sensitive
    expect(detectScanType('CERT_ABC')).toBe('unknown') // case-sensitive
    expect(detectScanType('')).toBe('unknown')
    expect(detectScanType('random-barcode')).toBe('unknown')
  })
})

describe('useBarcode – handleScan routing', () => {
  const mockToastAdd = vi.fn()
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetAllMocks()
    mockToastAdd.mockClear()

    // Mock Nuxt auto-imports used by useBarcode
    vi.stubGlobal('useToast', () => ({ add: mockToastAdd }))
    vi.stubGlobal('ref', (val: unknown) => ({ value: val }))
    vi.stubGlobal('onMounted', vi.fn())
    vi.stubGlobal('onUnmounted', vi.fn())

    fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
  })

  async function getHandleScan() {
    // Re-import to pick up mocked globals
    const mod = await import('~/app/composables/useBarcode')
    return mod.useBarcode().handleScan
  }

  it('looks up part when type is "part"', async () => {
    fetchMock.mockResolvedValueOnce({
      id: 'part_00001',
      jobId: 'job_1',
      pathId: 'path_1',
      currentStepId: 'step_2',
      certs: [{ id: 'cert_1' }],
    })

    const handleScan = await getHandleScan()
    await handleScan({ value: 'part_00001', type: 'part' })

    expect(fetchMock).toHaveBeenCalledWith('/api/parts/part_00001')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Part: part_00001',
        color: 'success',
      }),
    )
  })

  it('shows not found toast when part lookup fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('404'))

    const handleScan = await getHandleScan()
    await handleScan({ value: 'part_99999', type: 'part' })

    expect(fetchMock).toHaveBeenCalledWith('/api/parts/part_99999')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Not Found',
        color: 'error',
      }),
    )
  })

  it('looks up certificate when type is "certificate"', async () => {
    fetchMock.mockResolvedValueOnce({
      id: 'cert_abc',
      name: 'Steel Cert',
      type: 'material',
    })

    const handleScan = await getHandleScan()
    await handleScan({ value: 'cert_abc', type: 'certificate' })

    expect(fetchMock).toHaveBeenCalledWith('/api/certs/cert_abc')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cert: Steel Cert',
        color: 'success',
      }),
    )
  })

  it('shows not found toast when cert lookup fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('404'))

    const handleScan = await getHandleScan()
    await handleScan({ value: 'cert_missing', type: 'certificate' })

    expect(fetchMock).toHaveBeenCalledWith('/api/certs/cert_missing')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Not Found',
        color: 'error',
      }),
    )
  })

  it('tries part then cert for unknown type, finds part', async () => {
    fetchMock.mockResolvedValueOnce({
      id: 'UNKNOWN-1',
      jobId: 'job_1',
      pathId: 'path_1',
      currentStepId: 'step_0',
      certs: [],
    })

    const handleScan = await getHandleScan()
    await handleScan({ value: 'UNKNOWN-1', type: 'unknown' })

    expect(fetchMock).toHaveBeenCalledWith('/api/parts/UNKNOWN-1')
    // Should NOT try cert since part was found
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'success' }),
    )
  })

  it('tries part then cert for unknown type, finds cert', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('404')) // part not found
      .mockResolvedValueOnce({ id: 'x', name: 'Process Cert', type: 'process' }) // cert found

    const handleScan = await getHandleScan()
    await handleScan({ value: 'UNKNOWN-2', type: 'unknown' })

    expect(fetchMock).toHaveBeenCalledWith('/api/parts/UNKNOWN-2')
    expect(fetchMock).toHaveBeenCalledWith('/api/certs/UNKNOWN-2')
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cert: Process Cert',
        color: 'success',
      }),
    )
  })

  it('shows not found for unknown type when neither part nor cert exists', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('404'))
      .mockRejectedValueOnce(new Error('404'))

    const handleScan = await getHandleScan()
    await handleScan({ value: 'NOPE', type: 'unknown' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Not Found',
        description: expect.stringContaining('NOPE'),
        color: 'error',
      }),
    )
  })

  it('shows completed status for part at step -1', async () => {
    fetchMock.mockResolvedValueOnce({
      id: 'part_00005',
      jobId: 'job_2',
      pathId: 'path_2',
      currentStepId: null,
      certs: [],
    })

    const handleScan = await getHandleScan()
    await handleScan({ value: 'part_00005', type: 'part' })

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('Completed'),
      }),
    )
  })
})
