/**
 * ONE-OFF: remove duplicate media-library rows that share the same file URL.
 *
 * Earlier versions of the page template editor registered every device-pick
 * upload TWICE — once by /admin/media/upload's auto-register (defaulted to the
 * "General" category, no provenance) and once by an explicit POST /admin/media
 * (filed under the page's category, e.g. "Home", with provenance). The result:
 * the same image appeared under two page sections of the Media Library at once.
 *
 * This script groups MediaAsset rows by URL and, for each group with more than
 * one row, keeps the best entry and deletes the rest:
 *   keep = the row with template-editor provenance (sourcePage set) if any,
 *          tie-broken by the earliest createdAt.
 *
 * DRY RUN by default. Apply with:  npx ts-node src/media/dedupe-existing-media.oneoff.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const assets = await prisma.mediaAsset.findMany({
    select: {
      id: true,
      name: true,
      url: true,
      category: true,
      sourcePage: true,
      sourceSection: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const byUrl = new Map<string, typeof assets>();
  for (const asset of assets) {
    const list = byUrl.get(asset.url) ?? [];
    list.push(asset);
    byUrl.set(asset.url, list);
  }

  let duplicateGroups = 0;
  let removed = 0;

  for (const [url, rows] of byUrl) {
    if (rows.length < 2) continue;
    duplicateGroups++;
    // Keeper: provenance (uploaded from a page's template editor) wins, then
    // the earliest row — the original registration.
    const keeper =
      [...rows].sort((a, b) => {
        const pa = a.sourcePage ? 0 : 1;
        const pb = b.sourcePage ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })[0] ?? rows[0];
    const dupes = rows.filter((r) => r.id !== keeper.id);

    console.log(
      `\n· ${url}\n  keep: "${keeper.name}" (category: ${keeper.category}${keeper.sourcePage ? `, from: ${keeper.sourcePage}` : ', no provenance'})`,
    );
    for (const dupe of dupes) {
      console.log(`  ${APPLY ? 'delete' : 'WOULD delete'}: "${dupe.name}" (category: ${dupe.category})`);
      removed++;
      if (APPLY) {
        await prisma.mediaAsset.delete({ where: { id: dupe.id } });
      }
    }
  }

  console.log(
    `\n${duplicateGroups} duplicate URL group(s) found, ${removed} row(s) ${APPLY ? 'removed' : 'would be removed'}.`,
  );
  if (!APPLY) {
    console.log('DRY RUN — re-run with --apply to remove the duplicates.');
  } else if (removed > 0) {
    console.log(
      'The public media feed cache (in-memory, 60 s TTL) refreshes on its own; restart the backend to see it immediately.',
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
