"""Build the test report from pytest's report.json and POST it to the receiver.

Runs in CI after the tests (pass OR fail). Uses only the standard library.

Environment variables:
  PC_TAILSCALE_IP   Tailscale IP of the PC running backend/reciever.py
  RECEIVER_SECRET   Shared bearer token expected by the receiver
  RECEIVER_PORT     (optional) default 5000
  TEST_JOB_RESULT   (optional) result of the test job: success/failure/cancelled
  REPORT_FILE       (optional) path to pytest json report, default report.json
  DRY_RUN           (optional) if "1", print the payload instead of sending it
"""
import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.request


def build_payload() -> dict:
    path = os.environ.get("REPORT_FILE", "report.json")
    pytest_data = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            pytest_data = json.load(f)

    summary = pytest_data.get("summary", {})
    tests = []
    for item in pytest_data.get("tests", []):
        outcome = item.get("outcome")
        message = None
        if outcome in ("failed", "error"):
            # failure can happen in setup, call or teardown
            for phase in ("call", "setup", "teardown"):
                stage = item.get(phase) or {}
                if stage.get("outcome") == "failed":
                    crash = stage.get("crash") or {}
                    message = crash.get("message") or stage.get("longrepr")
                    break
        tests.append({"name": item.get("nodeid"), "result": outcome, "failure_message": message})

    total = summary.get("total", 0)
    passed = summary.get("passed", 0)
    failed = summary.get("failed", 0) + summary.get("error", 0)

    # "passed" only if tests really ran, none failed, and the test job succeeded
    job_result = os.environ.get("TEST_JOB_RESULT", "")
    ok = total > 0 and failed == 0 and job_result in ("", "success")

    return {
        "repository": os.environ.get("GITHUB_REPOSITORY"),
        "branch": os.environ.get("GITHUB_REF_NAME"),
        "commit_sha": os.environ.get("GITHUB_SHA"),
        "run_id": os.environ.get("GITHUB_RUN_ID"),
        "run_number": os.environ.get("GITHUB_RUN_NUMBER"),
        "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "status": "passed" if ok else "failed",
        },
        "tests": tests,
    }


def main() -> int:
    payload = build_payload()
    print(json.dumps(payload, indent=2))
    if os.environ.get("DRY_RUN") == "1":
        return 0

    ip = os.environ["PC_TAILSCALE_IP"]
    port = os.environ.get("RECEIVER_PORT", "5000")
    secret = os.environ["RECEIVER_SECRET"]
    url = f"http://{ip}:{port}/report"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {secret}"},
        method="POST",
    )
    for attempt in range(1, 6):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                print(f"Report delivered to {url}: HTTP {resp.status}")
                return 0
        except urllib.error.HTTPError as e:
            print(f"Attempt {attempt}: receiver answered HTTP {e.code}")
            if e.code in (400, 401):
                return 1  # retrying will not help
        except Exception as e:  # connection refused, timeout, ...
            print(f"Attempt {attempt}: could not reach {url}: {e}")
        time.sleep(3)
    print("Report could NOT be delivered. Is the receiver running and the PC online in Tailscale?")
    return 1


if __name__ == "__main__":
    sys.exit(main())