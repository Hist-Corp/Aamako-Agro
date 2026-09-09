import sharp from 'sharp';

/** Result of a compression pass. */
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
      return skipped('already well optimized', '.bin');
    }
    if (originalBytes > maxBytes) {
      return skipped('file too large to process safely', '.bin');
    }

    const input = sharp(buffer, { failOn: 'none', animated: false });
    const meta = await input.metadata();
    if (!meta.width || !meta.height || !meta.format) {
      return skipped('unreadable image metadata', '.bin');
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