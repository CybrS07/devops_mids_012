"""Local test-report receiver.

Receives the CI test report over HTTP and saves it as testreport.json
(latest run) in the project root, plus a copy in reports/ for history.

Start (from the project root):
    PowerShell:  $env:RECEIVER_SECRET="<same value as the GitHub secret>"
                 uv run python backend/reciever.py
    bash:        RECEIVER_SECRET=<secret> uv run python backend/reciever.py
"""
import json
import os
import sys
from pathlib import Path

from flask import Flask, jsonify, request

ROOT = Path(__file__).resolve().parent.parent
REPORT_FILE = ROOT / "testreport.json"
HISTORY_DIR = ROOT / "reports"

RECEIVER_SECRET = os.environ.get("RECEIVER_SECRET")
REQUIRED = ("repository", "branch", "commit_sha", "run_id", "timestamp", "summary", "tests")

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/report")
def receive_report():
    if request.headers.get("Authorization") != f"Bearer {RECEIVER_SECRET}":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"status": "error", "message": "No JSON payload received"}), 400
    missing = [k for k in REQUIRED if k not in data]
    if missing:
        return jsonify({"status": "error", "message": f"Missing fields: {missing}"}), 400

    text = json.dumps(data, indent=4)
    REPORT_FILE.write_text(text, encoding="utf-8")
    HISTORY_DIR.mkdir(exist_ok=True)
    sha = str(data["commit_sha"])[:7]
    (HISTORY_DIR / f"run-{data['run_id']}-{sha}-{data['summary']['status']}.json").write_text(
        text, encoding="utf-8"
    )

    print(f"[{data['timestamp']}] {data['summary']['status'].upper()} "
          f"{data['summary']['passed']}/{data['summary']['total']} -> {REPORT_FILE}")
    return jsonify({"status": "success"}), 200


if __name__ == "__main__":
    if not RECEIVER_SECRET:
        sys.exit("Set the RECEIVER_SECRET environment variable first (same value as the GitHub secret).")
    app.run(host="0.0.0.0", port=5000)