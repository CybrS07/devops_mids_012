# DevOps Assignment Submission Portal

A simple assignment submission portal built for **CSC418 – DevOps for Cloud Computing** (COMSATS University Islamabad, Attock Campus).

Students submit an assignment link, and teachers review it. Every code change is tested automatically, and a local receiver stores the test report as JSON.

- **Backend:** Python, FastAPI, JSON file storage
- **Frontend:** plain HTML, CSS and JavaScript (no build step)
- **Tests:** pytest
- **CI:** GitHub Actions
- **Report receiver:** small FastAPI app that saves the test report on your computer

## Requirements

- Python >= 3.13
- [`uv`](https://docs.astral.sh/uv/) package manager
- Git

## Project Structure

```
devops_mids_012/
├── backend/
│   ├── app.py            # Portal API (FastAPI)
│   ├── reciever.py       # Local test-report receiver
│   └── data/             # JSON storage (users, assignments, submissions)
├── frontend/
│   ├── index.html        # Login page
│   ├── dashboard.html    # Student / teacher dashboard
│   ├── style.css
│   └── script.js
├── tests/
│   └── test_portal.py    # Automated tests
├── .github/workflows/
│   └── ci.yml            # CI pipeline
├── pyproject.toml
└── README.md
```

> **Important:** run every command below from the **project root** (the folder that contains `backend/`, `frontend/` and `tests/`). The backend imports the `backend` package and reads its data from `backend/data`, so running it from another folder will fail.

## How to Run the Application

1. Install dependencies:
   ```bash
   uv sync
   ```

2. Start the backend API (Terminal 1):
   ```bash
   uv run uvicorn backend.app:app --port 8000
   ```
   The API is now running at `http://127.0.0.1:8000`. Keep this terminal open.

3. Start the frontend (Terminal 2):
   ```bash
   uv run python -m http.server 5500 --directory frontend
   ```

4. Open the portal in your browser: **http://localhost:5500**

### Demo accounts

All demo accounts use the password `password123`.

| Role    | Username       | Class     |
|---------|----------------|-----------|
| Student | `FA23-BAI-012` | AI7       |
| Student | `FA23-CS-001`  | CS5       |
| Teacher | `teacher1`     | AI7 + CS5 |

### Using the portal

**Teacher**
1. Sign in as `teacher1`.
2. Open **Assignments** and click **Publish assignment** to create one for a class.
3. Open **Submissions** to search and filter student submissions, then **Approve** or **Decline** the pending ones.
4. The **Overview** page shows charts of review status and submissions per assignment.

**Student**
1. Sign in with your registration number.
2. Open **Assignments** and click **Submit** next to an assignment.
3. Enter your full name and your submission URL (for example a GitHub repository link), then submit.
4. Track the status (Pending, Approved or Declined) on the same page. A declined submission can be resubmitted.

### Validation rules

- Name, registration number, assignment title and submission URL are required.
- The submission URL must be a valid `http://` or `https://` link.
- Invalid submissions are rejected and are not saved.
- A student can submit each assignment once, unless it was declined.

## How to Execute the Tests

Run from the project root:

```bash
uv run python -m pytest -v
```

The test suite covers the three required cases:

| Test case                               | Expected result                                      |
|-----------------------------------------|------------------------------------------------------|
| Complete details and a valid URL        | Submission is saved and appears in the list          |
| Missing registration number             | Submission is rejected with a validation message     |
| Invalid submission URL                  | Submission is rejected and is not saved              |

If any test fails, pytest exits with a non-zero code. This is what makes the CI test stage fail.

## How to Start the Report Receiver

The receiver is a local HTTP server that accepts the test report sent by the CI pipeline and saves it on your computer as JSON.

1. Start it from the project root (Terminal 3):
   ```bash
   uv run python backend/reciever.py
   ```
   It listens on `http://localhost:5000` and exposes `POST /report`.

2. Check that it works by sending a sample report.

   **Windows (PowerShell):**
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:5000/report -ContentType "application/json" -Body '{"test":"hello"}'
   ```

   **macOS / Linux:**
   ```bash
   curl -X POST http://localhost:5000/report -H "Content-Type: application/json" -d '{"test":"hello"}'
   ```

   You should get `{"status":"success","message":"Report saved successfully"}`, and the JSON file is written in the folder you started the receiver from.

3. Keep the receiver running while the pipeline runs.

> **Note:** a GitHub-hosted runner's `localhost` is the runner itself, not your computer. To deliver the report from GitHub Actions to your machine, expose the receiver with a tunnel (for example ngrok or Cloudflare Tunnel) and use the tunnel URL in the pipeline, or run a self-hosted runner on your computer.

## Continuous Integration

The workflow in `.github/workflows/ci.yml` runs on every push to the repository. It checks out the code, installs dependencies with `uv`, and runs the automated tests. A failing test fails the pipeline.

## API Reference

| Method | Endpoint                 | Description                                  |
|--------|--------------------------|----------------------------------------------|
| POST   | `/api/login`             | Sign in and get the user's role and class    |
| GET    | `/api/assignments`       | List assignments for a class or teacher      |
| POST   | `/api/assignments`       | Publish a new assignment (teacher)           |
| GET    | `/api/submissions`       | List submissions for a class or teacher      |
| POST   | `/api/submissions`       | Submit an assignment (validated)             |
| POST   | `/api/submissions/status`| Approve or decline a submission (teacher)    |

Interactive API docs are available at `http://127.0.0.1:8000/docs` while the backend is running.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError: No module named 'backend'` | You are not in the project root. Run `cd ..` until you are in the folder containing `backend/`, then run the command again. |
| Login page says "Cannot reach the server" | The backend is not running. Start it with the command in step 2. |
| Changes to the frontend do not appear | Hard refresh the browser with `Ctrl + F5`. |
| Port already in use | Stop the other program using that port, or choose a different one (for example `--port 8001`). If you change the backend port, update `API` at the top of `frontend/script.js`. |
| Pending submissions are missing | Open `http://127.0.0.1:8000/api/submissions` to see the raw data. Make sure the backend was started from the project root. |

## Author
Taha