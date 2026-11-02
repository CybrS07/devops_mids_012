document.addEventListener("DOMContentLoaded", async () => {
    // Show Password Toggle Handler
    const showPasswordCheckbox = document.getElementById("showPassword");
    if (showPasswordCheckbox) {
        showPasswordCheckbox.addEventListener("change", () => {
            const passwordInput = document.getElementById("password");
            passwordInput.type = showPasswordCheckbox.checked ? "text" : "password";
        });
    }

    // Login Form Handler
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;

            try {
                const res = await fetch("http://127.0.0.1:8000/api/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });

                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem("username", data.username);
                    localStorage.setItem("role", data.role);
                    const classGroupVal = Array.isArray(data.class_group) ? JSON.stringify(data.class_group) : data.class_group;
                    localStorage.setItem("class_group", classGroupVal);
                    window.location.href = "dashboard.html";
                } else {
                    alert("Invalid username or password.");
                }
            } catch (err) {
                alert("Could not connect to backend server.");
            }
        });
    }

    // Dashboard Initialization
    if (window.location.pathname.includes("dashboard.html")) {
        const role = localStorage.getItem("role");
        const classGroup = localStorage.getItem("class_group");
        const username = localStorage.getItem("username");

        if (!role) {
            window.location.href = "index.html";
            return;
        }

        if (role === "student") {
            document.getElementById("studentView").style.display = "block";
            document.getElementById("userGroup").textContent = classGroup;
            loadStudentAssignments(username, classGroup);
        } else if (role === "teacher") {
            document.getElementById("teacherView").style.display = "block";
            document.getElementById("teacherClasses").textContent = classGroup;
            
            let allowedClasses = [];
            try {
                allowedClasses = classGroup.startsWith("[") ? JSON.parse(classGroup) : classGroup.split(",").map(c => c.trim());
            } catch (e) {
                allowedClasses = [classGroup];
            }

            const targetSelect = document.getElementById("targetGroup");
            targetSelect.innerHTML = "";
            allowedClasses.forEach(cls => {
                const opt = document.createElement("option");
                opt.value = cls;
                opt.textContent = cls;
                targetSelect.appendChild(opt);
            });

            loadTeacherClassesView(allowedClasses);
        }
    }

    // Teacher Publish Assignment Handler
    const assignForm = document.getElementById("assignForm");
    if (assignForm) {
        assignForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const payload = {
                title: document.getElementById("astTitle").value,
                target_group: document.getElementById("targetGroup").value,
                created_by: localStorage.getItem("username")
            };

            const res = await fetch("http://127.0.0.1:8000/api/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Assignment published successfully!");
                assignForm.reset();
                const classGroup = localStorage.getItem("class_group");
                let allowedClasses = classGroup.startsWith("[") ? JSON.parse(classGroup) : classGroup.split(",").map(c => c.trim());
                loadTeacherClassesView(allowedClasses);
            }
        });
    }
});

// --- STUDENT DRILL-DOWN LOGIC ---

async function loadStudentAssignments(username, classGroup) {
    document.getElementById("backToAssignBtn").style.display = "none";
    const content = document.getElementById("studentContent");
    content.innerHTML = "<h3>Assignments for your class</h3>";

    const assignRes = await fetch(`http://127.0.0.1:8000/api/assignments?class_group=${classGroup}`);
    const assignments = await assignRes.json();

    const statusRes = await fetch(`http://127.0.0.1:8000/api/submission-status/${username}`);
    const submissions = await statusRes.json();

    if (assignments.length === 0) {
        content.innerHTML += "<p>No assignments published yet.</p>";
        return;
    }

    let listHTML = "<ul style='list-style: none; padding: 0;'>";
    assignments.forEach(a => {
        let existing = Array.isArray(submissions) ? submissions.find(s => s.assignment_title === a.title) : null;
        let statusBadge = "<span style='color: gray;'>Not Submitted</span>";
        
        if (existing) {
            let color = existing.status === "Approved" ? "green" : existing.status === "Declined" ? "red" : "orange";
            statusBadge = `<span style='color: ${color}; font-weight: bold;'>${existing.status}</span>`;
        }

        listHTML += `
            <li style="border: 1px solid #ddd; padding: 12px; margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${a.title}</strong><br>
                    Status: ${statusBadge}
                </div>
                <button onclick="openStudentSubmissionForm('${a.title}', '${classGroup}', '${username}')" style="padding: 5px 10px; cursor: pointer;">
                    ${existing && existing.status === 'Declined' ? 'Resubmit' : existing ? 'View' : 'Submit'}
                </button>
            </li>
        `;
    });
    listHTML += "</ul>";
    content.innerHTML += listHTML;
}

async function openStudentSubmissionForm(assignmentTitle, classGroup, username) {
    document.getElementById("backToAssignBtn").style.display = "inline-block";
    const content = document.getElementById("studentContent");

    const statusRes = await fetch(`http://127.0.0.1:8000/api/submission-status/${username}`);
    const submissions = await statusRes.json();
    const existing = Array.isArray(submissions) ? submissions.find(s => s.assignment_title === assignmentTitle) : null;

    if (existing && existing.status === "Approved") {
        content.innerHTML = `
            <h3>Assignment: ${assignmentTitle}</h3>
            <p>Status: <span style="color: green; font-weight: bold;">Approved</span></p>
            <p>URL: <a href="${existing.submission_url}" target="_blank">${existing.submission_url}</a></p>
            <p style="color: gray; font-style: italic;">This submission is approved and cannot be modified.</p>
        `;
        return;
    }

    content.innerHTML = `
        <h3>Submit for: ${assignmentTitle}</h3>
        <form id="activeSubForm">
            <input type="text" id="subName" placeholder="Full Name" required style="width: 100%; margin-bottom: 10px; padding: 8px;">
            <input type="text" id="subReg" value="${username}" readonly style="width: 100%; margin-bottom: 10px; padding: 8px; background: #eee;">
            <input type="url" id="subUrl" placeholder="Submission URL (GitHub / Drive)" required value="${existing ? existing.submission_url : ''}" style="width: 100%; margin-bottom: 10px; padding: 8px;">
            <button type="submit" style="background: #007bff; color: white; border: none; padding: 8px 15px; cursor: pointer;">Submit Assignment</button>
        </form>
    `;

    document.getElementById("activeSubForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById("subName").value,
            registration_number: username,
            assignment_title: assignmentTitle,
            submission_url: document.getElementById("subUrl").value,
            class_group: classGroup
        };

        const res = await fetch("http://127.0.0.1:8000/api/submissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("Submitted successfully!");
            loadStudentAssignments(username, classGroup);
        } else {
            alert("Submission failed.");
        }
    });
}

function resetStudentView() {
    const username = localStorage.getItem("username");
    const classGroup = localStorage.getItem("class_group");
    loadStudentAssignments(username, classGroup);
}

// --- TEACHER DRILL-DOWN LOGIC ---

async function loadTeacherClassesView(allowedClasses) {
    document.getElementById("teacherBreadcrumb").innerHTML = "<h4>Select a Class:</h4>";
    const content = document.getElementById("teacherContent");
    
    let html = "<ul style='list-style: none; padding: 0; display: flex; gap: 10px;'>";
    allowedClasses.forEach(cls => {
        html += `<li><button onclick="loadTeacherAssignmentsView('${cls}')" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;">Class: ${cls}</button></li>`;
    });
    html += "</ul>";
    content.innerHTML = html;
}

async function loadTeacherAssignmentsView(classGroup) {
    document.getElementById("teacherBreadcrumb").innerHTML = `
        <button onclick='let cg = localStorage.getItem("class_group"); let ac = cg.startsWith("[") ? JSON.parse(cg) : cg.split(","); loadTeacherClassesView(ac);' style="background: #6c757d; border:none; color:white; padding: 5px 10px; cursor:pointer;">&larr; Back to Classes</button>
        <h3>Assignments for Class: ${classGroup}</h3>
    `;
    const content = document.getElementById("teacherContent");

    const res = await fetch(`http://127.0.0.1:8000/api/assignments?class_group=${classGroup}`);
    const assignments = await res.json();

    if (assignments.length === 0) {
        content.innerHTML = "<p>No assignments published for this class yet.</p>";
        return;
    }

    let html = "<ul style='list-style: none; padding: 0;'>";
    assignments.forEach(a => {
        html += `
            <li style="border: 1px solid #ddd; padding: 12px; margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <strong>${a.title}</strong>
                <button onclick="loadTeacherSubmissionsView('${classGroup}', '${a.title}')" style="padding: 5px 10px; cursor: pointer;">View Submissions</button>
            </li>
        `;
    });
    html += "</ul>";
    content.innerHTML = html;
}

async function loadTeacherSubmissionsView(classGroup, assignmentTitle) {
    document.getElementById("teacherBreadcrumb").innerHTML = `
        <button onclick="loadTeacherAssignmentsView('${classGroup}')" style="background: #6c757d; border:none; color:white; padding: 5px 10px; cursor:pointer;">&larr; Back to Assignments</button>
        <h3>Submissions for: ${assignmentTitle} ([${classGroup}])</h3>
    `;
    const content = document.getElementById("teacherContent");

    const res = await fetch(`http://127.0.0.1:8000/api/submissions?teacher_classes=${encodeURIComponent(classGroup)}`);
    const data = await res.json();
    const filtered = data.filter(s => s.assignment_title === assignmentTitle && s.class_group === classGroup);

    if (filtered.length === 0) {
        content.innerHTML = "<p>No student submissions found for this assignment.</p>";
        return;
    }

    let html = "<ul style='list-style: none; padding: 0;'>";
    filtered.forEach(item => {
        let statusColor = item.status === 'Approved' ? 'green' : item.status === 'Declined' ? 'red' : 'orange';
        
        let actionButtons = "";
        if (item.status === "Pending") {
            actionButtons = `
                <button onclick="updateStatusAndReload('${item.registration_number}', '${item.assignment_title}', 'Approved', '${classGroup}')" style="background: green; color: white; padding: 5px 10px; border:none; cursor:pointer; margin-right: 5px;">Approve</button>
                <button onclick="updateStatusAndReload('${item.registration_number}', '${item.assignment_title}', 'Declined', '${classGroup}')" style="background: red; color: white; padding: 5px 10px; border:none; cursor:pointer;">Decline</button>
            `;
        } else {
            actionButtons = `<p style="font-style: italic; color: gray; margin: 5px 0 0 0;">Action already recorded (${item.status})</p>`;
        }

        html += `
            <li style="border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; border-radius: 4px;">
                ${item.name} (${item.registration_number})<br>
                URL: <a href="${item.submission_url}" target="_blank">View Link</a><br>
                Status: <span style="color: ${statusColor}"><strong>${item.status}</strong></span><br><br>
                ${actionButtons}
            </li>
        `;
    });
    html += "</ul>";
    content.innerHTML = html;
}

async function updateStatusAndReload(regNo, title, status, classGroup) {
    const res = await fetch("http://127.0.0.1:8000/api/submissions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_number: regNo, assignment_title: title, status: status })
    });
    if (res.ok) {
        loadTeacherSubmissionsView(classGroup, title);
    } else {
        alert("Failed to update status.");
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}