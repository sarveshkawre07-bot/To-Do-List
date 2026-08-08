import {
    auth,
    signOut
} from "../login/firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";


const logoutButton = document.getElementById("logoutBtn");


// Check authentication state
onAuthStateChanged(auth, (user) => {

    if (user) {

        console.log("Logged in user:", user);

        // Display user's name
        const userName = document.getElementById("userName");

        if (userName) {
            userName.textContent = user.displayName || "User";
        }


        // Display user's profile picture
        const profileImage = document.getElementById("profileImage");

        if (profileImage && user.photoURL) {
            profileImage.src = user.photoURL;
        }


    } else {

        // User is not logged in
        window.location.href = "../login/login.html";

    }

});


// Logout
logoutButton.addEventListener("click", async () => {

    try {

        await signOut(auth);

        localStorage.removeItem("user");

        window.location.href = "../login/login.html";

    } catch (error) {

        console.error("Logout failed:", error);

    }

});