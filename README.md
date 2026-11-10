# Assignment Submission Portal

CSC418 – DevOps for Cloud Computing (COMSATS University Islamabad, Attock Campus)

Students submit an assignment link. Every push to GitHub runs the tests automatically, and the test report is sent to my own computer and saved as `testreport.json`.

- **Backend:** Python + FastAPI
- **Frontend:** plain HTML, CSS, JavaScript
- **Tests:** pytest
- **CI:** GitHub Actions
- **Report receiver:** small Flask app (`backend/reciever.py`)

## What you need

- Python 3.13 or newer
- [uv](https://docs.astral.sh/uv/)
- Git

> Run every command from the **project root** (the folder that contains `backend/`, `frontend/` and `tests/`).

## 1. Run the application

```bash
uv sync
```

Terminal 1, the backend:

```bash
uv run uvicorn backend.app:app --port 8000
```

Terminal 2, the frontend:

```bash
uv run python -m http.server 5500 --directory frontend
```

Open **http://localhost:5500** in your browser.

## 2. Run the tests

```bash
uv run pytest -v
```

The tests check three things:

| Test | Expected result |
|---|---|
| Complete details and a valid URL | Submission is saved and shows in the list |
| Missing registration number | Rejected with a validation message |
| Invalid submission URL | Rejected and not saved |

If any test fails, pytest exits with an error, so the CI test job fails too.

## 3. Start the report receiver

The receiver runs on my computer and saves the report that CI sends.

**PowerShell**

```powershell
$env:RECEIVER_SECRET="my-secret"
uv run python backend/reciever.py
```

**Mac / Linux**

```bash
RECEIVER_SECRET=my-secret uv run python backend/reciever.py
```

It listens on port **5000** and saves the latest report as **`testreport.json`** in the project root. A copy of every report is also kept in the `reports/` folder.

Check that it is running: open `http://127.0.0.1:5000/health`. You should see `{"status":"ok"}`.

Keep this terminal open while the pipeline runs.

## 4. How the pipeline works

File: `.github/workflows/ci.yml`. It runs on every push and has four jobs:

1. **test**: installs the project and runs pytest. The result comes from really running the tests. A failed test makes this job fail.
2. **report**: runs after `test`, for passing **and** failing runs. It connects to my PC through Tailscale and sends the report. The receiver saves it as `testreport.json`.
3. **email** (bonus): emails the report for passing and failing runs.
4. **deploy** (bonus): publishes the frontend to GitHub Pages, only on `main` and only if all tests passed.

The report contains:
- repository, branch, commit SHA, run id and timestamp
- every test's name, result and failure message
- total, passed and failed counts, and the overall status

## 5. GitHub secrets

Go to **Settings → Secrets and variables → Actions** and add these.

**For sending the report to my PC (Tailscale)**

| Secret | What it is |
|---|---|
| `TS_AUTHKEY` | Tailscale auth key (reusable) |
| `PC_TAILSCALE_IP` | My PC's Tailscale IP (run `tailscale ip -4`) |
| `RECEIVER_SECRET` | Same value I set when starting the receiver |

Also: Tailscale must be running on my PC, and Windows Firewall must allow port 5000.

**For the email report (Brevo)**

| Secret | What it is |
|---|---|
| `BREVO_API_KEY` | Brevo API key |
| `EMAIL_FROM` | Sender address verified in Brevo |
| `EMAIL_TO` | Address that gets the report (can be changed any time) |

In Brevo, turn off the Authorised IPs blocking, because GitHub's IP address changes on every run.

## 6. GitHub Pages (bonus)

1. Go to **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main`. When the tests pass, the `deploy` job publishes the site.

Live URL: **https://cybrs07.github.io/devops_mids_012/**

Pages cannot run the Python backend, so the live site is a static demo of the frontend. Sign-in needs the backend running locally.

If tests fail, the `deploy` job is skipped and the old site stays as it is.

## 7. Demo steps

1. **Passing run:** push any small change. The run is green and `testreport.json` shows `"status": "passed"`.
2. **Failing run:** in `backend/app.py`, change `if not value.strip():` to `if False:` and push. The `test` job turns red and `testreport.json` shows `"status": "failed"` with the failure messages.
3. **Fixed run:** put the line back and push. The run is green again.

## Project structure

```
.
├── .github/workflows/ci.yml   # pipeline
├── backend/
│   ├── app.py                 # portal API
│   ├── reciever.py            # local report receiver
│   └── data/                  # JSON storage
├── frontend/                  # HTML, CSS, JS
├── scripts/
│   ├── send_report.py         # builds the report and sends it to the receiver
│   └── send_email.py          # emails the report
├── tests/test_portal.py       # automated tests
├── pyproject.toml
└── uv.lock
```