#!/usr/bin/env python3
import http.server
import socketserver
import os

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Vercel과 유사한 보안 헤더 추가
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        # CSP 헤더는 의도적으로 추가하지 않음 (Vercel 기본 동작 모방)
        super().end_headers()
    
    def guess_type(self, path):
        mimetype = super().guess_type(path)
        # JavaScript 파일에 대한 MIME 타입 강제 설정
        if path.endswith('.js'):
            return 'application/javascript'
        return mimetype

PORT = 8000
Handler = MyHTTPRequestHandler

print(f"서버 시작: http://localhost:{PORT}")
print("이 서버는 Vercel 배포 환경과 유사한 조건으로 실행됩니다.")
print("Ctrl+C로 종료하세요.")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()