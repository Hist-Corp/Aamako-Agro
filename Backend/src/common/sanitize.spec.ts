import { sanitizeRichText, stripHtml } from './sanitize';

describe('sanitize', () => {
  it('stripHtml removes tags but keeps text and paragraph structure', () => {
    expect(stripHtml('QA <img src=x onerror=alert(1)>')).toBe('QA');
    expect(stripHtml('<script>alert("xss")</script> — must render escaped, never execute.')).toBe(
      'alert("xss") — must render escaped, never execute.',
    );
    expect(stripHtml('Line one\n\nLine two')).toBe('Line one\n\nLine two');
    expect(stripHtml('   plain   ')).toBe('plain');
  });

  it('sanitizeRichText removes active content and keeps benign markup', () => {
    const dirty = [
      '<p>Hello <strong>world</strong></p>',
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      '<a href="javascript:alert(1)">bad</a>',
      '<iframe src="//evil.example"></iframe>',
    ].join('');
    const clean = sanitizeRichText(dirty);
    expect(clean).toContain('<p>Hello <strong>world</strong></p>');
    expect(clean).not.toMatch(/script|iframe/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).not.toMatch(/javascript:/i);

    expect(sanitizeRichText('<em>keep</em>')).toBe('<em>keep</em>');
  });
});
