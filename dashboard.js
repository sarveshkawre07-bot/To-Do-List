import {
    auth,
    signOut
} from "./login/firebase.js";

// Get user from localStorage
const user = JSON.parse(localStorage.getItem("user"));

// Show user information
if (user) {

    document.body.innerHTML += `
        <h2>Welcome ${user.name}</h2>
        <img src="${user.photo}" width="100">
        <p>${user.email}</p>
    `;

} else {

    alert("Please login first!");
    window.location.href = "login/login.html";
}

// Logout Button
const logoutButton = document.getElementById("logoutBtn");

logoutButton.addEventListener("click", logout);

async function logout() {

    try {

        await signOut(auth);

        localStorage.removeItem("user");

        window.location.href = "login/login.html";

    } catch (error) {

        console.error("Logout Error:", error);

    }

}