import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyD2B6GywfjWNvYoPvBsM97Z_Q0YK1Y736Y",
  authDomain: "pwr-gamingreimagined.firebaseapp.com",
  projectId: "pwr-gamingreimagined",
  storageBucket: "pwr-gamingreimagined.firebasestorage.app",
  messagingSenderId: "1031733683542",
  appId: "1:1031733683542:web:772729552ffce628a1e2f7",
  measurementId: "G-SKQX2P9LVR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const statusDiv = document.getElementById('loginStatus');

onAuthStateChanged(auth, (user) => {
  if (user) {
    // when logged in show username with click2logout
    const name = user.displayName || (user.email ? user.email.split('@')[0] : "User");
    
    statusDiv.innerHTML = `<a class="auth-link" id="logoutBtn" style="cursor:pointer;">${name}</a>`;
    
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
      e.preventDefault();
      signOut(auth).then(() => {
        window.location.reload();
      }).catch((error) => {
        console.error("Logout failed", error);
      });
    });

  } else {
    // when logged out show login button
    const currentPath = window.location.pathname + window.location.search;
    const loginUrl = `/login?returnTo=${encodeURIComponent(currentPath)}`;
    
    statusDiv.innerHTML = `<a href="${loginUrl}" class="auth-link">Log in</a>`;
  }
});