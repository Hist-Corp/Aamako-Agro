const { createHash } = require('node:crypto');
const { gzip } = require('node:zlib');
const { promisify } = require('node:util');
const compress = promisify(gzip);

// An explicit gzip;q=0 overrides a wildcard. Do not compress for clients
// that omit Accept-Encoding or decline gzip.
function acceptsGzip(header = '') {
  const entries = String(header).toLowerCase().split(',').map((part) => {
    const [name, ...params] = part.trim().split(';').map((s) => s.trim());
    const quality = params.find((p) => p.startsWith('q='));
    return { name, q: quality === undefined ? 1 : Number(quality.slice(2)) };
  });
  const entry = entries.find((e) => e.name === 'gzip') || entries.find((e) => e.name === '*');
  return Boolean(entry && entry.q > 0 && entry.q <= 1);
}

async function staticResponse(data, contentType, requestHeaders = {}) {
  // Weak validator represents the decoded content across gzip/identity encodings.
  // Hashing, unlike byte length, detects edits that don't change the file size.
  const etag = 'W/"' + createHash('sha256').update(data).digest('hex') + '"';
  const headers = {
    'Content-Type': contentType,
    ETag: etag,
    // Existing filenames and ?v= values are not content-addressed. Revalidate
    // rather than hide deployments behind an unsafe immutable/one-hour TTL.
    'Cache-Control': 'no-cache',
    Vary: 'Accept-Encoding',
  };
  const validators = String(requestHeaders['if-none-match'] || '').split(',').map(s => s.trim());
  if (validators.some(value => value === '*' || value.replace(/^W\//, '') === etag.slice(2))) {
    return { status: 304, headers, body: undefined };
  }
  const compressible = /^(text\/|application\/(javascript|json|xml)|image\/svg\+xml)/i.test(contentType);
  let body = data;
  if (data.length >= 1024 && compressible && acceptsGzip(requestHeaders['accept-encoding'])) {
    const encoded = await compress(data);
    if (encoded.length < data.length) {
      body = encoded;
      headers['Content-Encoding'] = 'gzip';
    }
  }
  headers['Content-Length'] = body.length;
  return { status: 200, headers, body };
}

module.exports = { staticResponse, acceptsGzip };
