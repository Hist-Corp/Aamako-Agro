import { Injectable, Logger } from '@nestjs/common';
import { compressImage, type CompressionResult } from './compress-image';

export type { CompressionResult };

/**
 * One-pass image optimizer for media uploads (Nest wrapper).
 *
 * The actual compression logic lives in the Nest-free `compress-image.ts`
 * core so the exact same code path also powers maintenance oneoffs and tests
 * without bootstrapping the framework. See that module for the full
 * storage/CPU/quality design notes.
 */
@Injectable()
export class ImageCompressionService {
  private readonly logger = new Logger(ImageCompressionService.name);

  async compress(buffer: Buffer, mimetype: string): Promise<CompressionResult> {
    return compressImage(buffer, mimetype, {
      warn: (message) => this.logger.warn(message),
    });
  }
}