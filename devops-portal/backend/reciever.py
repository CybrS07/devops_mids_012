from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class ReportReceiverHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        report = json.loads(post_data.decode('utf-8'))
        
        with open("test-report.json", "w", encoding="utf-8") as f:
            json.dump(report, f, indent=4)
            
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Report saved successfully as test-report.json")

def run_server(server_class=HTTPServer, handler_class=ReportReceiverHandler, port=5000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Local Report Receiver running on port {port}...")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()