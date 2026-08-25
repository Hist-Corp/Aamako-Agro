#!/usr/bin/env python3
"""Daemonize and serve Aama ko Agro on port 8080."""
import http.server, socketserver, os, sys

PORT = 3000
ROOT = os.path.dirname(os.path.abspath(__file__))

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a):
        pass

# Double-fork daemonize
if os.fork() > 0:
    sys.exit(0)
os.setsid()
if os.fork() > 0:
    sys.exit(0)

# Redirect stdout/stderr
sys.stdout = open('/tmp/agro-server.log', 'w')
sys.stderr = sys.stdout

os.chdir(ROOT)
httpd = socketserver.TCPServer(('0.0.0.0', PORT), H)
with open('/tmp/agro-server.pid', 'w') as f:
    f.write(str(os.getpid()))
print(f'Started on http://localhost:{PORT}', flush=True)
httpd.serve_forever()
