import sharp, { type Metadata, type Sharp } from 'sharp';
import {
  type ImageKind,
  type PipelineRule,
  type FormatSpec,
  IMAGE_KIND_RULES,
  RESPONSIVE_BREAKPOINTS,
  ASYNC_THRESHOLD_BYTES,
  MAX_UPLOAD_BYTES,
  SSIM_THRESHOLD,
  SSIM_MAX_QUALITY_BUMP,
  PASS_THROUGH_FORMATS,
} from './image-pipeline.config';

// ── Existing CompressionResult (kept for backward-compat with oneoff + tests) ──

/** Result of a single compression pass (legacy single-format output). */
export interface CompressionResult {
  /** Bytes to store on disk (compressed, or the original when skipping). */
  buffer: Buffer;
  mimetype: string;
  /** File extension matching the stored bytes (e.g. ".webp", ".jpg"). */
  extension: string;
  width: number | null;
  height: number | null;
  originalBytes: number;
  storedBytes: number;
  /** true when the bytes were re-encoded/optimized by this service. */
  optimized: boolean;
  /** Human-readable reason when optimization was skipped. */
  note?: string;
  /** Warning produced while handling a malformed/unsupported file. */
  warning?: string;
}

export interface CompressOptions {
  /** Called when a file can't be processed and the original is kept. */
    warn?: (message: string) => void;
}

// ── New pipeline types ──

/** A single generated variant (one width × one format). */
export interface ImageVariant {
  type: string;
  extension: string;
  width: number;
  height: number;
  bytes: number;
  ssimOk: boolean;
}

/** A width tier — contains all supported formats at that width. */
export interface ImageVariantSet {
  width: number;
  formats: ImageVariant[];
  ready: boolean;
}

/** Full pipeline result — the manifest stored alongside the image. */
export interface PipelineResult {
  originalBytes: number;
  originalWidth: number;
  originalHeight: number;
  originalMimetype: string;
  variants: ImageVariantSet[];
  fallbackFormat: FormatSpec;
  totalStoredBytes: number;
  skipped: boolean;
  skipNote?: string;
  warnings: string[];
}

/** Infer the image kind when none is explicitly provided. */
function inferKind(meta: Metadata): ImageKind {
  const hasAlpha = meta.hasAlpha;
  const isSmall = (meta.width ?? 0) * (meta.height ?? 0) < 200 * 200;
  if (hasAlpha && isSmall) return 'logo-icon';
  if (hasAlpha) return 'png-with-transparency';
    return 'auto';
}

/** Lightweight SSIM calculator using sharp raw-pixel extraction. Returns [0,1]. */
async function computeSSIM(original: Buffer, compressed: Buffer): Promise<number> {
  const compressedMeta = await sharp(compressed, { failOn: 'none' }).metadata();
  const resizedOriginal = await sharp(original, { failOn: 'none' })
    .resize(compressedMeta.width, compressedMeta.height, {
      fit: 'fill', withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const compressedRaw = await sharp(compressed, { failOn: 'none' }).raw().toBuffer({ resolveWithObject: true });
  const { data: oData, info: oInfo } = resizedOriginal;
  const { data: cData, info: cInfo } = compressedRaw;

  if (oInfo.width !== cInfo.width || oInfo.height !== cInfo.height) return 1.0;

  const pix = oInfo.width * oInfo.height;
  const len = pix * 3;
  const oLum: number[] = new Array(pix);
  const cLum: number[] = new Array(pix);
  for (let i = 0; i < len; i += 3) {
    const j = i / 3;
    oLum[j] = 0.299 * oData[i] + 0.587 * oData[i + 1] + 0.114 * oData[i + 2];
    cLum[j] = 0.299 * cData[i] + 0.587 * cData[i + 1] + 0.114 * cData[i + 2];
  }
  let oMean = 0, cMean = 0;
  for (let i = 0; i < pix; i++) { oMean += oLum[i]; cMean += cLum[i]; }
  oMean /= pix; cMean /= pix;
  let oVar = 0, cVar = 0, cov = 0;
  for (let i = 0; i < pix; i++) {
    const od = oLum[i] - oMean;
    const cd = cLum[i] - cMean;
    oVar += od * od;
    cVar += cd * cd;
    cov += od * cd;
  }
  oVar /= pix - 1; cVar /= pix - 1; cov /= pix - 1;
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  return ((2 * oMean * cMean + C1) * (2 * cov + C2)) /
        ((oMean ** 2 + cMean ** 2 + C1) * (oVar + cVar + C2));
}

/** Attach the correct encoder to a sharp pipeline based on the format spec. */
function getEncoder(pipeline: Sharp, format: FormatSpec, quality: number): Sharp {
  const q = Math.max(1, Math.min(100, quality));
  switch (format.type) {
    case 'image/avif':  return pipeline.avif({ quality: q, effort: 6 });
    case 'image/webp':  return format.lossless
      ? pipeline.webp({ quality: q, lossless: true, effort: 4 })
      : pipeline.webp({ quality: q, effort: 4, smartSubsample: true });
    case 'image/jpeg':  return pipeline.jpeg({ quality: q, mozjpeg: true, progressive: true });
    case 'image/png':   return pipeline.png({ quality: q, compressionLevel: 9 });
    default:            return pipeline.webp({ quality: q, effort: 4 });
  }
}

/** Build a single variant (one format at one target width) with SSIM validation. */
async function buildVariant(
  input: Sharp,
  originalMeta: Metadata,
  width: number,
  format: FormatSpec,
  warn: (msg: string) => void,
): Promise<ImageVariant | null> {
  const capW = Math.min(width, originalMeta.width ?? 0);
  if (capW <= 0) return null;

  let quality = format.quality;
  let variant: ImageVariant | null = null;

  for (let attempt = 0; attempt <= SSIM_MAX_QUALITY_BUMP; attempt++) {
    const pipeline = input
      .clone()
      .rotate()
      .resize(capW, capW, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' });

    let buf: Buffer;
    try {
      buf = await getEncoder(pipeline, format, quality).toBuffer();
    } catch {
      if (attempt === 0) warn(`Format ${format.type} unavailable for ${width}w — skipping`);
      break;
    }

    const meta = await sharp(buf, { failOn: 'none' }).metadata();

    if (format.lossless) {
      variant = { type: format.type, extension: format.extension,
        width: meta.width ?? capW, height: meta.height ?? capW,
        bytes: buf.byteLength, ssimOk: true };
      break;
    }

    const ssim = await computeSSIM(
      await input.clone().rotate().resize(capW, capW, {
        fit: 'inside', withoutEnlargement: true,
      }).toFormat('png').toBuffer(),
      buf,
    );

    variant = {
      type: format.type, extension: format.extension,
      width: meta.width ?? capW, height: meta.height ?? capW,
      bytes: buf.byteLength, ssimOk: ssim >= SSIM_THRESHOLD,
    };

    if (variant.ssimOk || quality + SSIM_MAX_QUALITY_BUMP >= 100) break;
    quality = Math.min(100, quality + SSIM_MAX_QUALITY_BUMP);
  }
  return variant;
}

/**
 * PURE image-optimizer core — deliberately free of any NestJS imports so it
 * can run inside the API, under plain node scripts (maintenance oneoffs) and
 * in tests without bootstrapping the framework.
 *
 * STORAGE: every upload is re-encoded to WebP (universally supported by all
 * modern browsers) at a visually-transparent quality and downscaled to at
 * most 1920px on its longest edge — the most any web layout needs. A 4000px
 * phone photo that lands as a 4 MB JPEG typically stores as ~150-400 KB.
 *
 * CPU: compression happens EXACTLY ONCE, at upload time (libvips is fast —
 * usually well under 200 ms per image). The storefront and API then serve the
 * optimized static file forever with zero per-request processing, and smaller
 * payloads cut transfer time for visitors.
 *
 * QUALITY GUARDS — an upload is stored byte-for-byte untouched when
 * optimization could make it worse:
 *  • animated images (GIF/WebP sequences) — re-encoding risks frame loss
 *  • SVG vectors — already tiny and resolution-independent
 *  • files under ~25 KB — nothing meaningful to save
 *  • when the re-encoded output is not smaller than the input
 * EXIF orientation is baked in (`.rotate()`) and metadata is stripped
 * (privacy + size), pixel content is never upscaled.
 */

/** Longest allowed edge in px. 1920 covers every hero/banner slot on retina. */
const maxEdge = Number(process.env.MEDIA_MAX_EDGE ?? 1920);
/** WebP quality for photographic JPEG/WebP inputs. */
const photoQuality = Number(process.env.MEDIA_WEBP_QUALITY ?? 82);
/** WebP quality for PNG graphics (sharp edges, text, transparency). */
const graphicQuality = Number(process.env.MEDIA_GRAPHIC_QUALITY ?? 90);
/** Below this size (bytes) optimization is not worth the CPU. */
const minBytes = 25 * 1024;
/** Skip compression entirely above this (safety valve; endpoint caps at 25 MB). */
const maxBytes = 25 * 1024 * 1024;

/** Map an upload's MIME type to a browser-renderable extension. Skipped files
 *  are stored byte-for-byte with THIS extension — never ".bin", or the stored
 *  URL would not render in an <img> and the dashboard/media sections would
 *  show a missing image. */
function extForMimetype(mimetype: string): string {
  return mimetype === 'image/png' ? '.png'
    : mimetype === 'image/webp' ? '.webp'
    : mimetype === 'image/gif' ? '.gif'
    : mimetype === 'image/svg+xml' ? '.svg'
    : mimetype === 'image/jpeg' ? '.jpg'
    : mimetype === 'image/avif' ? '.avif'
    : '.jpg';
}

export async function compressImage(
  buffer: Buffer,
  mimetype: string,
  options: CompressOptions = {},
): Promise<CompressionResult> {
  const originalBytes = buffer.byteLength;
  const skipped = (note: string, extension: string): CompressionResult => ({
    buffer,
    mimetype,
    extension,
    width: null,
    height: null,
    originalBytes,
    storedBytes: originalBytes,
    optimized: false,
    note,
  });

  try {
    if (mimetype === 'image/svg+xml') {
      return skipped('vector image stored as-is', '.svg');
    }
    if (mimetype === 'image/gif') {
      return skipped('animated image stored as-is', '.gif');
    }
    if (originalBytes < minBytes) {
      return skipped('already well optimized', extForMimetype(mimetype));
    }
    if (originalBytes > maxBytes) {
      return skipped('file too large to process safely', extForMimetype(mimetype));
    }

    const input = sharp(buffer, { failOn: 'none', animated: false });
    const meta = await input.metadata();
    if (!meta.width || !meta.height || !meta.format) {
      return skipped('unreadable image metadata', extForMimetype(mimetype));
    }
    // Second frame => animation (animated WebP uploads, multi-page TIFFs…).
    if ((meta.pages ?? 1) > 1) {
      return skipped('animated image stored as-is', `.${meta.format}`);
    }

    const isPngSource = meta.format === 'png';
    const output = await input
      .rotate() // bake EXIF orientation, then strip all metadata
      .resize(maxEdge, maxEdge, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3',
      })
      .webp({
        quality: isPngSource ? graphicQuality : photoQuality,
        effort: 4, // 0-6; 4 ≈ best size/CPU trade-off
        smartSubsample: true,
        ...(isPngSource ? { palette: true } : {}), // crisp graphics, tiny files
      })
      .toBuffer({ resolveWithObject: true });

    // NEVER store something bigger than what was uploaded.
    if (output.data.byteLength >= originalBytes) {
      return skipped('original already optimal', `.${meta.format}`);
    }

    return {
      buffer: output.data,
      mimetype: 'image/webp',
      extension: '.webp',
      width: output.info.width,
      height: output.info.height,
      originalBytes,
      storedBytes: output.data.byteLength,
      optimized: true,
    };
  } catch (err) {
    // A malformed/unsupported file must never break the upload.
    const message = `Compression skipped (${err instanceof Error ? err.message : 'unknown error'}) — storing original`;
    options.warn?.(message);
    const ext =
      mimetype === 'image/png' ? '.png'
      : mimetype === 'image/webp' ? '.webp'
      : mimetype === 'image/gif' ? '.gif'
      : mimetype === 'image/svg+xml' ? '.svg'
      : '.jpg';
    return { ...skipped('compression unavailable — stored original', ext), warning: message };
  }
}