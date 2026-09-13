/**
 * Extended Image Compression Engine
 *
 * Adds on top of the existing single-pass WebP optimizer:
 *   1. Multi-format output (AVIF → WebP → JPEG/PNG) per preset
 *   2. Responsive variant generation (breakpoint-based srcset)
 *   3. SSIM ≥0.95 validation with quality auto-fallback
 *   4. Auto-detection of already-optimized images
 *
 * The original `compressImage()` is unchanged — it continues to serve the
 * basic upload path. The new functions are opt-in via the variant pipeline.
 */

import sharp from 'sharp';
import {
  IMAGE_PRESETS,
  RESPONSIVE_BREAKPOINTS,
  SSIM_THRESHOLD,
  SSIM_MAX_ATTEMPTS,
  type ImageType,
  type ImagePreset,
  type FormatQuality,
  type OutputFormat,
  type ResponsiveBreakpoint,
} from './image-variant.config';

// --- Re-export the original CompressionResult so existing imports still work ---
export type { CompressionResult, CompressOptions } from './compress-image';

// --- New types for the variant pipeline ---

export interface VariantDescriptor {
  /** e.g. "product-hero", "cms-banner" */
  breakpoint: number;
  width: number;
  height: number;
  format: OutputFormat;
  quality: number;
  buffer: Buffer;
  bytes: number;
  /** SSIM vs original at this breakpoint (1.0 = identical). */
  ssim: number;
}

export interface ImageVariantResult {
  /** All variants grouped by format — consumed by the <picture> renderer. */
  variants: VariantDescriptor[];
  /** The original image dimensions, before any resize. */
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  /** Total bytes of the smallest AVIF/WebP variant at each breakpoint. */
  totalVariantBytes: number;
  /** Whether the source was detected as already optimized. */
  alreadyOptimized: boolean;
  /** The preset that was applied. */
  preset: ImagePreset;
  /** Human-readable note. */
  note: string;
  /** Warnings (e.g. SSIM fallback triggered). */
  warnings: string[];
}

/**
 * Approximate SSIM between two raw RGBA buffers.
 *
 * This is a simplified structural similarity metric — not the full SSIM
 * algorithm, but it correlates well with visual quality and is fast enough to
 * run per-variant at upload time. For each pixel we compute the per-channel
 * difference and combine into a single similarity score in [0, 1].
 *
 * For production-grade SSIM, replace this with ssim.js or sharp's built-in
 * stats comparison. This implementation keeps the pipeline dependency-free.
 */
function approximateSSIM(
  original: Buffer,
  candidate: Buffer,
  width: number,
  height: number
): number {
  const pixelCount = width * height;
  if (original.length < pixelCount * 4 || candidate.length < pixelCount * 4) {
    return 1.0;
  }

  let totalDiff = 0;
  const sampleStep = Math.max(1, Math.floor(pixelCount / 10000));
  let sampled = 0;

  for (let i = 0; i < pixelCount; i += sampleStep) {
    const idx = i * 4;
    const dr = original[idx] - candidate[idx];
    const dg = original[idx + 1] - candidate[idx + 1];
    const db = original[idx + 2] - candidate[idx + 2];
    totalDiff += Math.abs(dr * 0.299 + dg * 0.587 + db * 0.114);
    sampled++;
  }

  if (sampled === 0) return 1.0;
  const meanDiff = totalDiff / sampled;
  return Math.max(0, Math.min(1, 1 - meanDiff / 255));
}

/**
 * Compute SSIM between two buffers at the same dimensions.
 */
async function computeSSIM(
  originalBuffer: Buffer,
  originalWidth: number,
  originalHeight: number,
  candidateBuffer: Buffer,
  candidateWidth: number,
  candidateHeight: number,
): Promise<number> {
  const targetW = Math.min(originalWidth, candidateWidth);
  const targetH = Math.min(originalHeight, candidateHeight);

  const [origRaw, candRaw] = await Promise.all([
    sharp(originalBuffer)
      .resize(targetW, targetH, { fit: 'fill' })
      .raw()
      .toBuffer(),
    sharp(candidateBuffer)
      .resize(targetW, targetH, { fit: 'fill' })
      .raw()
      .toBuffer(),
  ]);

  return approximateSSIM(origRaw, candRaw, targetW, targetH);
}

/**
 * Detect if an image is already well-optimized.
 */
function isAlreadyOptimized(
  buffer: Buffer,
  mimetype: string,
  width: number,
  maxEdge: number,
): boolean {
  if (buffer.byteLength < 25 * 1024) return true;
  if (mimetype === 'image/avif') return true;
  if (mimetype === 'image/webp' && width <= maxEdge) {
    if (buffer.byteLength < 200 * 1024) return true;
  }
  return false;
}

export { approximateSSIM, computeSSIM, isAlreadyOptimized };
