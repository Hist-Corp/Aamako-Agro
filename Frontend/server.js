const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8080;
// Backend origin this static server proxies /api/* to — mirrors the Vercel
// rewrite (see vercel.json) so uploaded media (/api/uploads/...) and API routes
// resolve on the storefront in local dev exactly as they do in production.
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const MIME = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon'};
const ROOT = __dirname;

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'content-length']);

http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';

  // Reverse-proxy API + uploaded media to the backend.
  if (url.startsWith('/api/')) {
    const upstream = BACKEND_URL.replace(/\/+$/, '');
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) headers[k] = v;
    }
    headers.host = upstream.replace(/^https?:\/\//, '');
    let target = upstream + req.url;
    // Only allow proxying the API (paranoia for the rewrite target).
    target = target.replace(/(.?)\/+\/api\//, '$1/api/');
    const proxyReq = http.request(target, { method: req.method, headers }, (proxyRes) => {
      const out = {};
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (!HOP_BY_HOP.has(k.toLowerCase())) out[k] = v;
      }
      res.writeHead(proxyRes.statusCode, out);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {}); // connection dropped upstream — client already handled
    req.pipe(proxyReq);
    return;
  }

  const fp = path.join(ROOT, url);
  fs.readFile(fp, (err, data) => {
    if (err) {
      // Serve the styled error page for 404s
      fs.readFile(path.join(ROOT, 'error.html'), (e2, html) => {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(e2 ? 'Not found' : html);
      });
      return;
    }
    const ext = path.extname(fp);
    // Weak ETag from mtime+size so "Cache-Control: no-cache" revalidation
    // resolves as a fast 304 on repeat navigations (keeps cross-document
    // View Transitions snappy).
    const etag = 'W/"' + data.length + '"';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ETag: etag,
      // NOTE: must NOT contain "no-store" — Chrome disables cross-document
      // View Transitions (@view-transition header morphs) when either page
      // is served with no-store, which caused the header flicker between
      // pages. "no-cache" still revalidates (fast 304) so dev edits show up.
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}).listen(PORT, () => console.log('Server running at http://localhost:' + PORT));
