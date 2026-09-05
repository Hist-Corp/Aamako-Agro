/* eslint-disable */
// ─── Seed CMS content from the storefront ────────────────────────────
// Reads every storefront HTML page, extracts each [data-cms] element
// (key + field + the visible text/HTML the site currently shows) and
// upserts ContentItems so the Dashboard Page editor is pre-filled with
// the storefront's real copy. The storefront's static markup/design is
// NOT modified — new items are created as drafts (unpublished) so the
// live site keeps rendering its authored HTML exactly as before.
//
// Field mapping (mirrors Frontend/js/content.js):
//   no field / data-cms-field="title"  -> title
//   data-cms-field="short"             -> shortDescription
//   data-cms-field="long"              -> longDescription
//   data-cms-field="body"              -> body
//
// Usage:  npm run seed:storefront       (from the Backend directory)

import { PrismaClient } from '@prisma/client';
import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const prisma = new PrismaClient();
const FRONTEND_DIR = resolve(__dirname, '../../Frontend');

/** Self-closing / void elements never wrap content. */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

interface CmsHit {
  key: string;
  field: 'title' | 'short' | 'long' | 'body';
  html: string;
}

/**
 * Tiny HTML scanner: finds every element carrying data-cms="…" and returns
 * its inner content together with the field the attribute maps to.
 */
function extractCmsElements(html: string): CmsHit[] {
  const hits: CmsHit[] = [];
  const tagRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*?)?)>/g;
  let m: RegExpExecArray | null;
  const stack: Array<{ tag: string; cms: CmsHit | null; contentStart: number }> = [];

  while ((m = tagRe.exec(html))) {
    const token = m[0];
    if (token.startsWith('<!--')) continue;
    const closing = token.startsWith('</');
    const tag = (m[1] || '').toLowerCase();
    const attrs = m[2] || '';

    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag !== tag) continue;
        const el = stack[i];
        stack.splice(i, 1);
        if (el.cms) {
          hits.push({
            key: el.cms.key,
            field: el.cms.field,
            html: html.slice(el.contentStart, m.index).trim(),
          });
        }
        break;
      }
      continue;
    }

    // Void / self-closing elements can't wrap content, but they may still be
    // CMS-editable via an attribute — e.g.
    //   <input data-cms="page.shop.search.placeholder" data-cms-attr="placeholder">
    // content.js writes the item's title into that attribute (form controls
    // get their placeholder replaced), so seed the attribute's current value
    // as the default title.
    if (VOID_TAGS.has(tag) || /\/\s*>$/.test(token)) {
      const voidKey = attrs.match(/\bdata-cms="([^"]+)"/);
      if (!voidKey) continue;
      const attrName =
        attrs.match(/\bdata-cms-attr="([^"]+)"/)?.[1] ??
        (tag === 'input' || tag === 'textarea' ? 'placeholder' : null);
      const attrText = attrName
        ? attrs.match(new RegExp(`\\b${attrName}="([^"]*)"`))?.[1]
        : undefined;
      if (attrText) hits.push({ key: voidKey[1], field: 'title', html: attrText });
      continue;
    }

    const keyMatch = attrs.match(/\bdata-cms="([^"]+)"/);
    const fieldMatch = attrs.match(/\bdata-cms-field="([^"]+)"/);
    const isHtml = /\bdata-cms-html\b/.test(attrs);
    const field = (fieldMatch && fieldMatch[1]) || (isHtml ? 'body' : 'title');

    stack.push({
      tag,
      cms: keyMatch
        ? {
            key: keyMatch[1],
            field: ['title', 'short', 'long', 'body'].includes(field) ? (field as CmsHit['field']) : 'title',
            html: '',
          }
        : null,
      contentStart: m.index + token.length,
    });
  }
  return hits;
}

/** Strip tags + decode basic entities for fallback titles. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Human-readable fallback title derived from a dot-separated content key. */
function fallbackTitle(key: string): string {
  const last = key.split('.').pop() || key;
  return last.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normText(v: string): string {
  return v.includes('<') ? v : stripHtml(v);
}

async function main() {
  const files = readdirSync(FRONTEND_DIR).filter((f) => f.endsWith('.html'));
  const byKey = new Map<string, Partial<Record<CmsHit['field'], string>>>();

  for (const file of files) {
    const html = readFileSync(join(FRONTEND_DIR, file), 'utf8');
    if (!html.includes('data-cms=')) continue;
    for (const hit of extractCmsElements(html)) {
      if (!hit.html) continue;
      const rec = byKey.get(hit.key) || {};
      if (!rec[hit.field]) rec[hit.field] = hit.html;
      byKey.set(hit.key, rec);
    }
  }

  const keys = [...byKey.keys()].sort();
  console.log(`Extracted ${keys.length} content keys from ${files.length} storefront pages.`);

  let created = 0;
  let updated = 0;

  for (const key of keys) {
    const rec = byKey.get(key)!;
    // Title: prefer a real title element; fall back to the short text so the
    // dashboard form is understandable; never dump raw HTML into the title.
    const title = rec.title
      ? normText(rec.title)
      : rec.short
        ? normText(rec.short)
        : fallbackTitle(key);
    const existing = await prisma.contentItem.findUnique({ where: { key } });

    const data = {
      title,
      // Keep existing values for fields the storefront doesn't populate, so we
      // never wipe out previously-written content.
      shortDescription: rec.short ? normText(rec.short) : (existing?.shortDescription ?? null),
      longDescription: rec.long ? normText(rec.long) : (existing?.longDescription ?? null),
      body: rec.body ?? existing?.body ?? '',
    };

    if (existing) {
      await prisma.contentItem.update({ where: { key }, data });
      updated++;
    } else {
      // Draft by default — the live storefront keeps its authored HTML until
      // the item is published, so no design mechanism is changed.
      await prisma.contentItem.create({ data: { key, isPublished: false, ...data } });
      created++;
    }
  }

  console.log(`Storefront CMS seed complete: ${created} created, ${updated} updated.`);
  const sample = keys.slice(0, 8);
  console.log('Sample keys:', sample.join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());