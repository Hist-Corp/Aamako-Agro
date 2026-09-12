/**
 * Single source of truth for the image optimization pipeline.
 *
 * All quality tables, breakpoints, and format-priority ladders live here so
 * the backend processor, the dashboard widget, and the storefront component
 * all read the same definition.
 *
 * Mirrors the "Processing Rules" + "Responsive Variants" sections of the spec.
 */

/** Responsive widths (px) the pipeline emits per image — srcset candidates. */
export const RESPONSIVE_BREAKPOINTS = [
  320, 640, 768, 1024, 1440, 1920,
] as const;

export type Breakpoint = (typeof RESPONSIVE_BREAKPOINTS)[number];

/**
 * Image use-case kinds. The uploader passes one (or leaves `undefined` to
 * fall back to `auto`). `auto` = infer from file size / dimension heuristics.
 */
export type ImageKind =
  | 'product-hero'
  | 'product-thumbnail'
  | 'product-gallery-zoom'
  | 'cms-banner-hero'
  | 'cms-inline'
  | 'png-with-transparency'
  | 'logo-icon'
  | 'auto';

export interface FormatSpec {
  /** MIME type string used in <source type="..."> and sharp encoders. */
  type: 'image/avif' | 'image/webp' | 'image/jpeg' | 'image/png';
  /** Sharp encoder quality (0-100). */
  quality: number;
  /** File extension including the dot, e.g. ".avif". */
  extension: string;
  /** Lossless flag overrides quality when true (WebP/AVIF only). */
  lossless?: boolean;
}

/** One pipeline rule row. */
export interface PipelineRule {
  /** Max dimension (longest side) in pixels. null = no resize. */
  maxDimension: number | null;
  /** Quality table indexed by output format. Always ordered AVIF > WebP > JPEG. */
  formats: FormatSpec[];
  /** Minimum original bytes before optimization is attempted. */
  minBytes?: number;
}

/**
 * Per-image-kind configuration. The FIRST supported format is the primary
 * output; later entries are fallbacks for browsers that don't support it.
 *
 * Nepal-context: AVIF is preferred over WebP where a browser supports it
 * because AVIF delivers ~20-30% smaller files at equivalent quality, which
 * matters for 3G/4G users.
 */
export const IMAGE_KIND_RULES: Record<ImageKind, PipelineRule> = {
  'product-hero': {
    maxDimension: 2048,
    minBytes: 25 * 1024,
    formats: [
      { type: 'image/avif',  quality: 50, extension: '.avif' },
      { type: 'image/webp',  quality: 75, extension: '.webp' },
      { type: 'image/jpeg',  quality: 80, extension: '.jpg'  },
    ],
  },
  'product-thumbnail': {
    maxDimension: 400,
    minBytes: 10 * 1024,
    formats: [
      { type: 'image/avif',  quality: 45, extension: '.avif' },
      { type: 'image/webp',  quality: 70, extension: '.webp' },
      { type: 'image/jpeg',  quality: 80, extension: '.jpg'  },
    ],
  },
  'product-gallery-zoom': {
    maxDimension: 3000,
    minBytes: 25 * 1024,
    formats: [
      { type: 'image/avif',  quality: 60, extension: '.avif' },
      { type: 'image/webp',  quality: 80, extension: '.webp' },
      { type: 'image/jpeg',  quality: 85, extension: '.jpg'  },
    ],
  },
  'cms-banner-hero': {
    maxDimension: 2048,
    minBytes: 25 * 1024,
    formats: [
      { type: 'image/avif',  quality: 50, extension: '.avif' },
      { type: 'image/webp',  quality: 75, extension: '.webp' },
      { type: 'image/jpeg',  quality: 80, extension: '.jpg'  },
    ],
  },
  'cms-inline': {
    maxDimension: 1200,
    minBytes: 15 * 1024,
    formats: [
      // Per spec: CMS inline content biases toward WebP (no AVIF).
      { type: 'image/webp',  quality: 75, extension: '.webp' },
      { type: 'image/jpeg',  quality: 80, extension: '.jpg'  },
    ],
  },
  'png-with-transparency': {
    // Preserve alpha. Sharp's WebP is lossless for transparency; fall back to
    // PNG passthrough if the lossless WebP isn't smaller than the original.
    maxDimension: 2048,
    minBytes: 20 * 1024,
    formats: [
      { type: 'image/webp',  quality: 80, lossless: true, extension: '.webp' },
      { type: 'image/png',   quality: 100, extension: '.png' },
    ],
  },
  'logo-icon': {
    // Vector-first: SVG passthrough. For raster logos, keep PNG and don't
    // aggressively re-encode (sharp edges don't benefit from JPEG).
    maxDimension: 1024,
    minBytes: 10 * 1024,
    formats: [
      { type: 'image/png',  quality: 100, extension: '.png' },
    ],
  },
  // Auto = infer from source. Heuristic:
  //   • PNG with alpha + <50 KB → PNG passthrough (logo/icon)
  //   • PNG with alpha + ≥50 KB → WebP lossless (or fallback PNG)
  //   • anything else → AVIF → WebP → JPEG ladder (product-hero rule)
  auto: {
    maxDimension: 1920,
    minBytes: 20 * 1024,
    formats: [
      { type: 'image/avif',  quality: 50, extension: '.avif' },
      { type: 'image/webp',  quality: 75, extension: '.webp' },
      { type: 'image/jpeg',  quality: 80, extension: '.jpg'  },
    ],
  },
};

/** Minimum and maximum upload size before rejection / async queue. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;     // 25 MB — reject pre-process
export const ASYNC_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB — queue instead of sync

/** SSIM quality gate: a variant must be ≥0.95 similar to the original,
 * or the encoder retries at higher quality (up to 5 points). */
export const SSIM_THRESHOLD = 0.95;
export const SSIM_MAX_QUALITY_BUMP = 5;

/** Formats that are always stored byte-for-byte (never rasterized). */
export const PASS_THROUGH_FORMATS = new Set<string>([
  'image/svg+xml',
]);

/** Animated image types skipped for re-encoding. */
export const ANIMATED_FORMATS = new Set<string>([
  'image/gif',
  'image/webp',
]);

/** Default fallback for storefront <img src> when no format is supported
 * by the browser (extremely old browsers). Uses the primary format's
 * fallback (JPEG for photos, PNG for graphics). */
