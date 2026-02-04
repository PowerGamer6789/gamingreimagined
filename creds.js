import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyD2B6GywfjWNvYoPvBsM97Z_Q0YK1Y736Y",
  authDomain: "pwr-gamingreimagined.firebaseapp.com",
  projectId: "pwr-gamingreimagined",
  storageBucket: "pwr-gamingreimagined.firebasestorage.app",
  messagingSenderId: "1031733683542",
  appId: "1:1031733683542:web:772729552ffce628a1e2f7",
  measurementId: "G-SKQX2P9LVR"
};

// init firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ui element
const statusDiv = document.getElementById("loginStatus");

// auth listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    // logged in → show name, go to /account
    const name =
      user.displayName ||
      (user.email ? user.email.split("@")[0] : "User");

    statusDiv.innerHTML = `
      <a href="/account" class="auth-link">${name}</a>
    `;
  } else {
    // logged out → login link w/ returnTo
    const currentPath =
      window.location.pathname + window.location.search;

    const loginUrl = `/login?returnTo=${encodeURIComponent(currentPath)}`;

    statusDiv.innerHTML = `
      <a href="${loginUrl}" class="auth-link">Log in</a>
    `;
  }
});

export { auth };