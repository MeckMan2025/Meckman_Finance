#!/usr/bin/env python3
"""
Simple HTTP server for local development of Finance Teacher app
Serves static files and handles CORS for API requests
"""

import http.server
import socketserver
import os
from pathlib import Path

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == "__main__":
    PORT = 8000
    
    # Change to the directory containing this script
    os.chdir(Path(__file__).parent)
    
    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        print(f"🚀 Finance Teacher development server running at:")
        print(f"   http://localhost:{PORT}")
        print(f"\n📁 Serving files from: {os.getcwd()}")
        print(f"🔑 Using API key from main.js")
        print(f"\nPress Ctrl+C to stop the server")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print(f"\n\n✅ Development server stopped")
            httpd.shutdown()