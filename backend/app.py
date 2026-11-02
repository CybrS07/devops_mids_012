import json
import os
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = "backend/data"
os.makedirs(DATA_DIR, exist_ok=True)

USERS_FILE = os.path.join(DATA_DIR, "users.json")
ASSIGNMENTS_FILE = os.path.join(DATA_DIR, "assignments.json")
SUBMISSIONS_FILE = os.path.join(DATA_DIR, "submissions.json")

def read_json(path):
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

class Submission(BaseModel):
    name: str
    registration_number: str
    assignment_title: str
    submission_url: HttpUrl
    class_group: str

class Assignment(BaseModel):
    title: str
    target_group: str
    created_by: str

class UserLogin(BaseModel):
    username: str
    password: str

class StatusUpdate(BaseModel):
    registration_number: str
    assignment_title: str
    status: str

@app.post("/api/login")
def login(user: UserLogin):
    users = read_json(USERS_FILE)
    for u in users:
        if u["username"] == user.username and u["password"] == user.password:
            return {
                "status": "success",
                "username": u["username"],
                "role": u["role"],
                "class_group": u.get("class_group", "")
            }
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.get("/api/submission-status/{reg_no}")
def check_submission_status(reg_no: str):
    submissions = read_json(SUBMISSIONS_FILE)
    for sub in submissions:
        if sub["registration_number"] == reg_no:
            return {
                "submitted": True,
                "submission": sub
            }
    return {"submitted": False}

@app.post("/api/submissions")
def create_submission(sub: Submission):
    if not sub.registration_number.strip():
        raise HTTPException(status_code=400, detail="Missing registration number")
    
    submissions = read_json(SUBMISSIONS_FILE)
    existing_index = -1
    
    for i, s in enumerate(submissions):
        if s["registration_number"] == sub.registration_number and s["assignment_title"] == sub.assignment_title:
            existing_index = i
            break

    if existing_index != -1:
        if submissions[existing_index]["status"] == "Declined":
            submissions[existing_index]["submission_url"] = str(sub.submission_url)
            submissions[existing_index]["status"] = "Pending"
            write_json(SUBMISSIONS_FILE, submissions)
            return {"status": "success", "message": "Resubmitted successfully"}
        else:
            raise HTTPException(status_code=400, detail="You have already submitted")

    new_sub = {
        "name": sub.name,
        "registration_number": sub.registration_number,
        "assignment_title": sub.assignment_title,
        "submission_url": str(sub.submission_url),
        "class_group": sub.class_group,
        "status": "Pending"
    }
    submissions.append(new_sub)
    write_json(SUBMISSIONS_FILE, submissions)
    return {"status": "success", "message": "Submission saved successfully"}

@app.get("/api/submissions")
def get_submissions(teacher_classes: str = None):
    submissions = read_json(SUBMISSIONS_FILE)
    if teacher_classes:
        # teacher_classes can be passed as a JSON list string or comma string
        try:
            allowed = json.loads(teacher_classes) if teacher_classes.startswith("[") else [c.strip() for c in teacher_classes.split(",")]
        except:
            allowed = [c.strip() for c in teacher_classes.split(",")]
        return [s for s in submissions if s.get("class_group") in allowed]
    return submissions

@app.post("/api/submissions/status")
def update_submission_status(update: StatusUpdate):
    submissions = read_json(SUBMISSIONS_FILE)
    updated = False
    for s in submissions:
        if s["registration_number"] == update.registration_number and s["assignment_title"] == update.assignment_title:
            s["status"] = update.status
            updated = True
            break
            
    if updated:
        write_json(SUBMISSIONS_FILE, submissions)
        return {"status": "success", "message": f"Submission {update.status}"}
    
    raise HTTPException(status_code=404, detail="Submission record not found")

@app.post("/api/assignments")
def create_assignment(assignment: Assignment):
    assignments = read_json(ASSIGNMENTS_FILE)
    assignments.append({
        "title": assignment.title,
        "target_group": assignment.target_group,
        "created_by": assignment.created_by
    })
    write_json(ASSIGNMENTS_FILE, assignments)
    return {"status": "success", "message": "Assignment created"}

@app.get("/api/assignments")
def get_assignments(class_group: str = None, teacher_classes: str = None):
    assignments = read_json(ASSIGNMENTS_FILE)
    if class_group:
        return [a for a in assignments if a.get("target_group") == class_group]
    if teacher_classes:
        try:
            allowed = json.loads(teacher_classes) if teacher_classes.startswith("[") else [c.strip() for c in teacher_classes.split(",")]
        except:
            allowed = [c.strip() for c in teacher_classes.split(",")]
        return [a for a in assignments if a.get("target_group") in allowed]
    return assignments