#!/usr/bin/env python3
"""Minimal static file server for Aama ko Agro."""
import http.server, socketserver, os, signal, sys

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a):
        pass  # quiet

os.chdir(ROOT)
httpd = socketserver.TCPServer(('', PORT), Handler)
print(f'✅ Aama ko Agro running at http://localhost:{PORT}')
print('   Press Ctrl+C to stop.')
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print('\nStopped.')
    httpd.server_close()
