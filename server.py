# server.py — a tiny dev web server that tells the browser NOT to cache files,
# so you always get the latest code on refresh (no more stale-cache surprises).
#
# Usage:  py server.py <port> <folder>
#   e.g.  py server.py 8000 .

import http.server
import socketserver
import sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
directory = sys.argv[2] if len(sys.argv) > 2 else '.'


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', port), NoCacheHandler) as httpd:
    print('Eldenmoor server (no-cache) on http://localhost:%d  serving %s' % (port, directory))
    httpd.serve_forever()
