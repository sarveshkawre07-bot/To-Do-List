import {
    auth,
    provider
} from "./firebase.js";

import {
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is logged in
    } else {
        // Redirect to login
    }
});

if (user) {

    window.location.href = "../index.html";

}

const loginButton = document.getElementById("googleLogin");

loginButton.addEventListener("click", signIn);

async function signIn() {

    try {

        const result = await signInWithPopup(auth, provider);

        const user = result.user;
        
        localStorage.setItem(
            "user",
            JSON.stringify({
                uid: user.uid,
                name: user.displayName,
                email: user.email,
                photo: user.photoURL
            
            })
);
        
        console.log(user);
        
        window.location.href = "../index.html";

    } catch (error) {

        console.error(error);

    }

}