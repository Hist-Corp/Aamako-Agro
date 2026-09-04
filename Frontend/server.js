const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8080;
const MIME = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon'};
const ROOT = __dirname;
http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
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
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
}).listen(PORT, () => console.log('Server running at http://localhost:' + PORT));
