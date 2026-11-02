document.addEventListener("DOMContentLoaded", async () => {
    // Show Password Toggle Handler
    const showPasswordCheckbox = document.getElementById("showPassword");
    if (showPasswordCheckbox) {
        showPasswordCheckbox.addEventListener("change", () => {
            const passwordInput = document.getElementById("password");
            passwordInput.type = showPasswordCheckbox.checked ? "text" : "password";
        });
    }

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;

            const res = await fetch("http://127.0.0.1:8000/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem("username", data.username);
                localStorage.setItem("role", data.role);
                localStorage.setItem("class_group", data.class_group);
                window.location.href = "dashboard.html";
            } else {
                alert("Invalid username or password.");
            }
        });
    }

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
            checkStudentSubmission(username, classGroup);
        } else if (role === "teacher") {
            document.getElementById("teacherView").style.display = "block";
            document.getElementById("teacherClasses").textContent = classGroup;
            
            // Populate target group dropdown for teacher based on allowed classes (e.g., AI7, CS5)
            const allowedClasses = classGroup.split(",").map(c => c.trim());
            const targetSelect = document.getElementById("targetGroup");
            targetSelect.innerHTML = "";
            allowedClasses.forEach(cls => {
                const opt = document.createElement("option");
                opt.value = cls;
                opt.textContent = cls;
                targetSelect.appendChild(opt);
            });

            loadTeacherSubmissions(classGroup);
        }
    }

    const subForm = document.getElementById("subForm");
    if (subForm) {
        subForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const payload = {
                name: document.getElementById("name").value,
                registration_number: document.getElementById("regNo").value,
                assignment_title: document.getElementById("assignSelect").value,
                submission_url: document.getElementById("url").value,
                class_group: localStorage.getItem("class_group")
            };
            const res = await fetch("http://127.0.0.1:8000/api/submissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                alert("Assignment submitted successfully!");
                location.reload();
            } else {
                alert("Submission failed.");
            }
        });
    }

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
            }
        });
    }
});

async function checkStudentSubmission(regNo, classGroup) {
    const statusRes = await fetch(`http://127.0.0.1:8000/api/submission-status/${regNo}`);
    const statusData = await statusRes.json();

    // Fetch assignments for this class group
    const assignRes = await fetch(`http://127.0.0.1:8000/api/assignments?class_group=${classGroup}`);
    const assignments = await assignRes.json();
    const select = document.getElementById("assignSelect");
    select.innerHTML = "";
    assignments.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.title;
        opt.textContent = a.title;
        select.appendChild(opt);
    });

    if (statusData.submitted) {
        const sub = statusData.submission;
        document.getElementById("statusContainer").style.display = "block";
        document.getElementById("subStatus").textContent = sub.status;
        document.getElementById("subTitle").textContent = sub.assignment_title;
        document.getElementById("subLinkText.href") = sub.submission_url;
        document.getElementById("subLinkText").textContent = sub.submission_url;
        document.getElementById("subLinkText").href = sub.submission_url;

        if (sub.status === "Approved") {
            document.getElementById("subForm").style.display = "none";
        } else if (sub.status === "Declined") {
            document.getElementById("resubmitSection").style.display = "block";
            document.getElementById("subForm").style.display = "block";
            document.getElementById("submitBtn").textContent = "Resubmit Assignment";
        } else {
            // Pending
            document.getElementById("subForm").style.display = "none";
        }
    } else {
        document.getElementById("statusContainer").style.display = "none";
        document.getElementById("subForm").style.display = "block";
    }
}

async function loadTeacherSubmissions(teacherClasses) {
    const res = await fetch(`http://127.0.0.1:8000/api/submissions?teacher_classes=${encodeURIComponent(teacherClasses)}`);
    const data = await res.json();
    const list = document.getElementById("subList");
    list.innerHTML = "";
    data.forEach(item => {
        const li = document.createElement("li");
        li.style.border = "1px solid #ddd";
        li.style.padding = "10px";
        li.style.marginBottom = "8px";
        li.style.borderRadius = "4px";
        li.innerHTML = `
            <strong>[${item.class_group}]</strong> ${item.name} (${item.registration_number})<br>
            Assignment: ${item.assignment_title}<br>
            URL: <a href="${item.submission_url}" target="_blank">View Link</a><br>
            Status: <span style="color: ${item.status === 'Approved' ? 'green' : item.status === 'Declined' ? 'red' : 'orange'}"><strong>${item.status}</strong></span><br><br>
            <button onclick="updateStatus('${item.registration_number}', '${item.assignment_title}', 'Approved')" style="background: green; color: white; padding: 5px 10px; border:none; cursor:pointer;">Approve</button>
            <button onclick="updateStatus('${item.registration_number}', '${item.assignment_title}', 'Declined')" style="background: red; color: white; padding: 5px 10px; border:none; cursor:pointer;">Decline</button>
        `;
        list.appendChild(li);
    });
}

async function updateStatus(regNo, title, status) {
    await fetch("http://127.0.0.1:8000/api/submissions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_number: regNo, assignment_title: title, status: status })
    });
    loadTeacher1Classes(); // reload
    location.reload();
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}