/**
 * BarcodeDetector API type declarations.
 * Available in Chrome 83+, Edge 83+, Opera 69+.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
 */

interface DetectedBarcode {
  readonly boundingBox: DOMRectReadOnly
  readonly cornerPoints: ReadonlyArray<{ x: number; y: number }>
  readonly format: string
  readonly rawValue: string
}

interface BarcodeDetectorOptions {
  formats?: string[]
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  static getSupportedFormats(): Promise<string[]>
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>
}

declare namespace globalThis {
  // eslint-disable-next-line no-var
  var BarcodeDetector: typeof BarcodeDetector | undefined
}
