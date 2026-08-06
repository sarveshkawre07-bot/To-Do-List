// Firebase App
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

// Firebase Authentication
import {
    getAuth,
    GoogleAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsKtWW-RXBW14q1QSffFmUmkeH83uktxE",
  authDomain: "to-do-list-96823.firebaseapp.com",
  projectId: "to-do-list-96823",
  storageBucket: "to-do-list-96823.firebasestorage.app",
  messagingSenderId: "461092992667",
  appId: "1:461092992667:web:0b140298c6eb497221b83e"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export {

    auth,

    provider,

    signOut

};