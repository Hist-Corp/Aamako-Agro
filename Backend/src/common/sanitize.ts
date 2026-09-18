/**
 * Input sanitization helpers — defense-in-depth for user/staff-authored text.
 *
 * The render layer already escapes (React, and `esc()` in the storefront),
 * but sanitizing at the API boundary means the database never stores active
 * content in the first place: no XSS payload survives a copy into another
 * surface (emails, exports, future clients) and QA's stored-payload probe
 * stays green by construction.
 */

const HTML_TAG = /<[^>]*>/g;

/**
 * Strip markup from plain-text fields (names, titles, descriptions).
 * Tags are removed, surrounding whitespace trimmed; newlines and all other
 * characters are preserved (paragraph structure must survive).
 */
export function stripHtml(input: string): string {
  return input.replace(HTML_TAG, '').trim();
}

/**
 * Neutralize active content in rich-text fields that the storefront renders
 * via innerHTML (`data-cms-html` contract in Frontend/js/content.js):
 * - script/iframe/object/embed/style/link/meta blocks and orphans
 * - inline event handlers (`on*="…"`)
 * - `javascript:` URLs in href/src
 * Benign formatting (<p>, <strong>, <em>, headings, links, images, lists)
 * is preserved so the CMS editor keeps working.
 */
export function sanitizeRichText(html: string): string {
  return html
    .replace(
      /<\s*(script|iframe|object|embed|style|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      '',
    )
    .replace(/<\s*(script|iframe|object|embed|style|link|meta)\b[^>]*\/?\s*>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]*)/gi,
      ' $1="#"',
    );
}
