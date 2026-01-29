document.addEventListener("DOMContentLoaded", () => {
    const editBtn = document.querySelector(".btn-secondary");

    if (!editBtn) return;

    editBtn.addEventListener("click", enableEditMode);
});

function enableEditMode() {
    const usernameEl = document.querySelector(".profile-details h1");
    const emailEl = document.querySelector(".profile-email");

    if (!usernameEl || !emailEl) return;

    const currentUsername = usernameEl.textContent.trim();
    const currentEmail = emailEl.textContent.trim();

    usernameEl.innerHTML = `<input id="editUsername" value="${currentUsername}">`;
    emailEl.innerHTML = `<input id="editEmail" value="${currentEmail}">`;

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save Changes";
    saveBtn.className = "btn btn-primary";
    saveBtn.onclick = saveProfile;

    usernameEl.parentElement.appendChild(saveBtn);
}

function saveProfile() {
    const username = document.getElementById("editUsername").value.trim();
    const email = document.getElementById("editEmail").value.trim();

    if (!username || !email) {
        alert("Username and email cannot be empty");
        return;
    }

    fetch("/api/profile/update", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            email
        })
    })
    .then(res => res.json())
    .then(data => {
        if (!data.success) {
            alert(data.message || "Update failed");
            return;
        }

        // Update UI
        document.querySelector(".profile-details h1").textContent = data.user.username;
        document.querySelector(".profile-email").textContent = data.user.email;

        alert("Profile updated successfully ✅");
        location.reload();
    })
    .catch(err => {
        console.error(err);
        alert("Server error");
    });
}
