import { Module } from '@nestjs/common';
import { MediaController, StorefrontMediaController } from './media.controller';
import { MediaService } from './media.service';
import { ImageCompressionService } from './image-compression.service';

@Module({
  controllers: [MediaController, StorefrontMediaController],
  providers: [MediaService, ImageCompressionService],
  exports: [MediaService],
})
export class MediaModule {}