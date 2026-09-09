/**
 * ONE-OFF: compress the media library's existing files in place.
 *
 * For every MediaAsset whose file lives under Backend/uploads:
 *   1. run it through ImageCompressionService (same path as new uploads),
 *   2. when optimized, write the .webp next to the original,
 *   3. repoint every DB reference to the old URL —
 *        MediaAsset.url / MediaAsset.size / MediaAsset.dimensions
 *        ContentItem.body           (image sections store their URL here)
 *        ContentRevision.proposedBody (pending revisions must stay restorable)
 *        Product.imageUrl
 *   4. delete the original only after every reference moved.
 *
 * DRY RUN by default. Apply with:  npx ts-node src/media/compress-existing-media.oneoff.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
// Nest-free compression core — importing the @Injectable service here would
// pull @nestjs/common into a plain-node process (circular-import crash).
import { compressImage } from './compress-image';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const uploadsDir = path.join(process.cwd(), 'uploads');

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/** Same human format the dashboard stores ("812.3 KB" / "1.4 MB"). */
function sizeLabel(bytes: number): string {
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
}

async function main() {
  const assets = await prisma.mediaAsset.findMany({
    select: { id: true, name: true, url: true, size: true },
    orderBy: { createdAt: 'asc' },
  });

  let scanned = 0;
  let optimizedCount = 0;
  let skippedCount = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const asset of assets) {
    scanned++;
    const m = asset.url.match(/\/uploads\/([^/?#]+)$/);
    if (!m) { console.log(`· skip (not a local upload): ${asset.name}`); skippedCount++; continue; }
    const oldFile = m[1];
    const ext = path.extname(oldFile).toLowerCase();
    const oldPath = path.join(uploadsDir, oldFile);
    if (ext === '.webp') { console.log(`· skip (already webp): ${oldFile}`); skippedCount++; continue; }
    if (!fs.existsSync(oldPath)) { console.log(`· skip (file missing): ${oldFile}`); skippedCount++; continue; }

    const buffer = fs.readFileSync(oldPath);
    const result = await compressImage(buffer, MIME_BY_EXT[ext] ?? 'image/jpeg', {
      warn: (msg) => console.warn(`   ⚠ ${msg}`),
    });
    bytesBefore += buffer.byteLength;
    bytesAfter += result.storedBytes;

    if (!result.optimized) {
      console.log(`· skip (${result.note}): ${oldFile} (${buffer.byteLength} B)`);
      skippedCount++;
      continue;
    }

    const newFile = `${path.basename(oldFile, ext)}${result.extension}`;
    const newPath = path.join(uploadsDir, newFile);
    const newUrl = asset.url.replace(oldFile, newFile);
    const dims = result.width && result.height ? `${result.width}×${result.height}` : undefined;
    console.log(
      `↑ ${oldFile}  ${(buffer.byteLength / 1024).toFixed(0)} KB  →  ${newFile}  ${(result.storedBytes / 1024).toFixed(0)} KB` +
        (dims ? `  (${dims})` : ''),
    );

    if (APPLY) {
      fs.writeFileSync(newPath, result.buffer);
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { url: newUrl, size: sizeLabel(result.storedBytes), ...(dims ? { dimensions: dims } : {}) },
      });
      // Repoint every table that stores the URL verbatim.
      const content = await prisma.contentItem.updateMany({ where: { body: asset.url }, data: { body: newUrl } });
      const revisions = await prisma.contentRevision.updateMany({ where: { proposedBody: asset.url }, data: { proposedBody: newUrl } });
      const products = await prisma.product.updateMany({ where: { imageUrl: asset.url }, data: { imageUrl: newUrl } });
      const refs = content.count + revisions.count + products.count;
      if (refs > 0) console.log(`   repointed ${refs} reference(s) (content ${content.count}, revisions ${revisions.count}, products ${products.count})`);
      fs.unlinkSync(oldPath); // only after all references moved
    }
    optimizedCount++;
  }

  const savedPct = bytesBefore > 0 ? Math.round((1 - bytesAfter / bytesBefore) * 100) : 0;
  console.log(
    `\n${APPLY ? 'APPLIED' : 'DRY RUN'} — scanned ${scanned}, would optimize ${optimizedCount}, skipped ${skippedCount}; ` +
      `${(bytesBefore / 1024 / 1024).toFixed(2)} MB → ${(bytesAfter / 1024 / 1024).toFixed(2)} MB (${savedPct}% smaller)`,
  );
  if (!APPLY) console.log('Re-run with --apply to write the changes.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());