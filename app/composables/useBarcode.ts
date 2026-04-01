export type ScanType = 'part' | 'certificate' | 'unknown'

export interface ScanResult {
  value: string
  type: ScanType
}

/**
 * Detects whether a scanned/typed value is a Part, Certificate, or unknown.
 * - Starts with "SN-" or "part_" → part
 * - Starts with "cert_" → certificate
 * - Otherwise → unknown
 */
export function detectScanType(value: string): ScanType {
  if (value.startsWith('SN-') || value.startsWith('part_')) return 'part'
  if (value.startsWith('cert_')) return 'certificate'
  return 'unknown'
}

export function useBarcode() {
  const barcodeInputRef = ref<HTMLInputElement | null>(null)
  const toast = useToast()

  function focusBarcodeInput() {
    barcodeInputRef.value?.focus()
  }

  // Global `/` hotkey — skip when user is already typing in an input/textarea
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== '/') return

    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
      return
    }

    e.preventDefault()
    focusBarcodeInput()
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })

  /**
   * Handles a scan result by looking up the value as a part or certificate.
   * - part: fetches part detail, shows toast with job/step info
   * - certificate: fetches cert detail, shows toast with cert info
   * - unknown: tries part first, then cert, shows "not found" if neither matches
   *
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.8
   */
  async function handleScan(result: ScanResult) {
    if (result.type === 'part') {
      await lookupPart(result.value)
    } else if (result.type === 'certificate') {
      await lookupCert(result.value)
    } else {
      // Unknown type — try part first, then cert
      const foundPart = await lookupPart(result.value, true)
      if (!foundPart) {
        const foundCert = await lookupCert(result.value, true)
        if (!foundCert) {
          toast.add({
            title: 'Not Found',
            description: `"${result.value}" not found as Part or Certificate`,
            color: 'error'
          })
        }
      }
    }
  }

  /**
   * Looks up a part by ID and shows a toast with its status.
   * Returns true if found, false if not found.
   * When `silent` is true, suppresses the "not found" toast (used for unknown-type fallback).
   */
  async function lookupPart(id: string, silent = false): Promise<boolean> {
    try {
      const part = await $fetch<{
        id: string
        jobId: string
        pathId: string
        currentStepId: string | null
        certs: unknown[]
      }>(`/api/parts/${id}`)

      toast.add({
        title: `Part: ${part.id}`,
        description: `Job: ${part.jobId} · Step: ${part.currentStepId === null ? 'Completed' : part.currentStepId} · Certs: ${part.certs.length}`,
        color: 'success'
      })
      return true
    } catch {
      if (!silent) {
        toast.add({
          title: 'Not Found',
          description: `Part "${id}" not found`,
          color: 'error'
        })
      }
      return false
    }
  }

  /**
   * Looks up a certificate by ID and shows a toast with its details.
   * Returns true if found, false if not found.
   * When `silent` is true, suppresses the "not found" toast (used for unknown-type fallback).
   */
  async function lookupCert(id: string, silent = false): Promise<boolean> {
    try {
      const cert = await $fetch<{
        id: string
        name: string
        type: string
      }>(`/api/certs/${id}`)

      toast.add({
        title: `Cert: ${cert.name}`,
        description: `Type: ${cert.type}`,
        color: 'success'
      })
      return true
    } catch {
      if (!silent) {
        toast.add({
          title: 'Not Found',
          description: `Certificate "${id}" not found`,
          color: 'error'
        })
      }
      return false
    }
  }

  return {
    barcodeInputRef,
    focusBarcodeInput,
    detectScanType,
    handleScan,
    lookupPart,
    lookupCert
  }
}
