from flask import Flask, request, jsonify
import json
import os

app = Flask(__name__)
RECEIVER_SECRET = os.environ.get("RECEIVER_SECRET", "my-super-secret-token")

@app.route('/report', methods=['POST'])
def receive_report():
    auth_header = request.headers.get("Authorization")
    if not auth_header or auth_header != f"Bearer {RECEIVER_SECRET}":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No JSON payload received"}), 400
    
    file_path = os.path.join(os.getcwd(), 'test-report.json')
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4)
        
    print(f"Report saved securely to {file_path}")
    return jsonify({"status": "success"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)