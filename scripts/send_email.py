"""Email the test report (passing or failing runs). Standard library only.

Credentials come from environment variables (set from GitHub secrets):
  SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD
  EMAIL_TO    recipient address(es), comma separated  (configurable)
  EMAIL_FROM  optional, defaults to SMTP_USER
  DRY_RUN=1   print the email instead of sending it
Port 465 uses SSL, any other port uses STARTTLS.
"""
import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

from send_report import build_payload  # same folder


def build_message(payload: dict, sender: str, to: str) -> EmailMessage:
    s = payload["summary"]
    status = s["status"].upper()
    repo = payload["repository"]
    sha = str(payload["commit_sha"] or "")
    run_url = f"https://github.com/{repo}/actions/runs/{payload['run_id']}"

    lines = [
        f"Overall result : {status}",
        f"Repository     : {repo}",
        f"Branch         : {payload['branch']}",
        f"Commit         : {sha}",
        f"Pipeline run   : {payload['run_id']}  ({run_url})",
        f"Timestamp      : {payload['timestamp']}",
        "",
        f"Total: {s['total']}   Passed: {s['passed']}   Failed: {s['failed']}",
        "",
        "Individual results:",
    ]
    for t in payload["tests"]:
        lines.append(f"  [{str(t['result']).upper():6}] {t['name']}")
        if t.get("failure_message"):
            lines.append(f"           -> {t['failure_message']}")
    if not payload["tests"]:
        lines.append("  (no tests were executed)")

    msg = EmailMessage()
    msg["Subject"] = f"[{status}] {repo} @ {sha[:7]} - {s['passed']}/{s['total']} tests passed"
    msg["From"] = sender
    msg["To"] = to
    msg.set_content("\n".join(lines))
    msg.add_attachment(
        json.dumps(payload, indent=4).encode(),
        maintype="application", subtype="json", filename="testreport.json",
    )
    return msg


def main() -> int:
    payload = build_payload()
    to = os.environ.get("EMAIL_TO", "")
    if os.environ.get("DRY_RUN") == "1":
        msg = build_message(payload, os.environ.get("EMAIL_FROM", "ci@example.com"), to or "you@example.com")
        print(msg.as_string())
        return 0

    missing = [k for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_TO") if not os.environ.get(k)]
    if missing:
        print(f"Missing secrets/environment variables: {', '.join(missing)}")
        return 1

    host, user, password = os.environ["SMTP_HOST"], os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"]
    port = int(os.environ.get("SMTP_PORT") or 587)
    msg = build_message(payload, os.environ.get("EMAIL_FROM") or user, to)

    ctx = ssl.create_default_context()
    if port == 465:
        server = smtplib.SMTP_SSL(host, port, context=ctx, timeout=30)
    else:
        server = smtplib.SMTP(host, port, timeout=30)
        server.starttls(context=ctx)
    with server:
        server.login(user, password)
        server.send_message(msg)
    print(f"Report emailed to {to} ({payload['summary']['status']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
