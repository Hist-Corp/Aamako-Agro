/**
 * Image Variant Configuration — the quality/breakpoint table from the spec.
 *
 * This is the single source of truth for the pipeline. The processing service
 * reads `presets` to decide max-edge + per-format qualities, and `breakpoints`
 * to build srcsets. Edit this file to tune quality without touching logic.
 *
 * Nepal-context note: biases toward smaller max dimensions & AVIF (best
 * compression) for the 3G/4G mobile-first audience.
 */

export type ImageType =
  | 'product-hero'
  | 'product-thumbnail'
  | 'product-gallery-zoom'
  | 'cms-banner'
  | 'cms-inline'
  | 'png-transparency'
  | 'logo-icon';

export type OutputFormat = 'avif' | 'webp' | 'jpeg' | 'png';

export interface FormatQuality {
  format: OutputFormat;
  quality: number; // 0-100 JPEG/WebP/AVIF quality knob
  effort?: number; // AVIF 0-9, WebP 0-6 (higher = smaller + slower)
}

export interface ImagePreset {
  type: ImageType;
  /** Max edge in px. Variants are capped to min(breakpoint, maxEdge). */
  maxEdge: number;
  /**
   * Format priority order. The pipeline generates each in order, validates
   * SSIM ≥ threshold, and emits a <picture> with sources in this priority.
   */
  formats: FormatQuality[];
  /**
   * For png-transparency: if lossless WebP exceeds this, fall back to lossy.
   * null = always lossless.
   */
  losslessMaxBytes?: number | null;
}

/** Standard responsive breakpoints (w-descriptors in srcset). */
export const RESPONSIVE_BREAKPOINTS = [320, 640, 768, 1024, 1440, 1920] as const;

export type ResponsiveBreakpoint = (typeof RESPONSIVE_BREAKPOINTS)[number];

/**
 * SSIM-equivalent quality guard. We approximate SSIM via a structural
 * similarity metric computed from sharp's raw pixel buffers. Below this, the
 * pipeline raises quality one step and re-encodes.
 *
 * 0.95 ≈ "visually lossless" — the threshold the spec calls for.
 */
export const SSIM_THRESHOLD = 0.95;

/**
 * Max quality the auto-fallback will try before accepting the best it got.
 * Prevents infinite loops on pathological inputs.
 */
export const SSIM_MAX_ATTEMPTS = 3;

/**
 * Preset table — matches the spec's §3 Processing Rules.
 *
 * - product-hero: 2048px, AVIF q50 / WebP q75 / JPEG q80
 * - product-thumbnail: 400px, AVIF q45 / WebP q70
 * - product-gallery-zoom: 3000px, AVIF q60 / WebP q80
 * - cms-banner: per-breakpoint (maxEdge = largest breakpoint), AVIF q50 / WebP q75
 * - cms-inline: 1200px, WebP q75
 * - png-transparency: preserve alpha, lossless WebP <50KB else lossy q80
 * - logo-icon: SVG passthrough (handled separately), PNG otherwise
 */
export const IMAGE_PRESETS: Record<ImageType, ImagePreset> = {
  'product-hero': {
    type: 'product-hero',
    maxEdge: 2048,
    formats: [
      { format: 'avif', quality: 50, effort: 4 },
      { format: 'webp', quality: 75, effort: 4 },
      { format: 'jpeg', quality: 80, effort: 4 },
    ],
  },
  'product-thumbnail': {
    type: 'product-thumbnail',
    maxEdge: 400,
    formats: [
      { format: 'avif', quality: 45, effort: 3 },
      { format: 'webp', quality: 70, effort: 3 },
      { format: 'jpeg', quality: 80, effort: 4 },
    ],
  },
  'product-gallery-zoom': {
    type: 'product-gallery-zoom',
    maxEdge: 3000,
    formats: [
      { format: 'avif', quality: 60, effort: 5 },
      { format: 'webp', quality: 80, effort: 4 },
      { format: 'jpeg', quality: 85, effort: 4 },
    ],
  },
  'cms-banner': {
    type: 'cms-banner',
    maxEdge: 1920,
    formats: [
      { format: 'avif', quality: 50, effort: 4 },
      { format: 'webp', quality: 75, effort: 4 },
      { format: 'jpeg', quality: 80, effort: 4 },
    ],
  },
  'cms-inline': {
    type: 'cms-inline',
    maxEdge: 1200,
    formats: [
      { format: 'webp', quality: 75, effort: 4 },
      { format: 'jpeg', quality: 80, effort: 4 },
    ],
  },
  'png-transparency': {
    type: 'png-transparency',
    maxEdge: 1920,
    losslessMaxBytes: 50 * 1024,
    formats: [
      { format: 'webp', quality: 80, effort: 4 },
      { format: 'png', quality: 90, effort: 4 },
    ],
  },
  'logo-icon': {
    type: 'logo-icon',
    maxEdge: 512,
    formats: [
      { format: 'webp', quality: 85, effort: 4 },
      { format: 'png', quality: 90, effort: 4 },
    ],
  },
};

/**
 * Pick a preset from context. The upload endpoint passes an explicit `imageType`
 * body field; the media-library endpoint infers from category/section. This
 * function centralizes that inference so the rest of the pipeline never
 * hardcodes image-type logic.
 */
export function resolveImageType(hints: {
  imageType?: string;
  category?: string;
  sourceSection?: string;
  hasTransparency?: boolean;
}): ImageType {
  if (hints.imageType && hints.imageType in IMAGE_PRESETS) {
    return hints.imageType as ImageType;
  }

  // Transparency always wins — we must preserve alpha.
  if (hints.hasTransparency) return 'png-transparency';

  const section = (hints.sourceSection ?? '').toLowerCase();
  const category = (hints.category ?? '').toLowerCase();

  if (/banner|hero|slideshow|carousel/.test(section)) return 'cms-banner';
  if (/thumbnail|thumb/.test(section)) return 'product-thumbnail';
  if (/gallery|zoom/.test(section)) return 'product-gallery-zoom';
  if (/logo|icon/.test(section) || /logo|icon/.test(category)) return 'logo-icon';
  if (/hero|masthead/.test(category)) return 'cms-banner';
  if (/inline|content|body/.test(section)) return 'cms-inline';

  // Default to the most common product image type.
  return 'product-hero';
}
