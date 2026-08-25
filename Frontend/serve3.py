#!/usr/bin/env python3
"""Simple HTTP server for Aama ko Agro — no forking."""
import http.server, socketserver, os, signal, sys

PORT = 3000
ROOT = os.path.dirname(os.path.abspath(__file__))

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a):
        pass

signal.signal(signal.SIGHUP, signal.SIG_IGN)
os.chdir(ROOT)
httpd = socketserver.TCPServer(('0.0.0.0', PORT), H)
httpd.allow_reuse_address = True
with open('/tmp/agro-server.pid', 'w') as f:
    f.write(str(os.getpid()))
print(f'Serving on http://localhost:{PORT}', flush=True)
httpd.serve_forever()
