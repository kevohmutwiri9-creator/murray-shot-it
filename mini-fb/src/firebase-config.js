import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let _app;

export function initFirebase() {
  if (_app) return _app;

  const firebaseConfig = {
    apiKey: "AIzaSyC8fJn-09U4I_8YL6YTSyx4YV6wg1YMj7U",
    authDomain: "snapverse-32683.firebaseapp.com",
    projectId: "snapverse-32683",
    storageBucket: "snapverse-32683.firebasestorage.app",
    messagingSenderId: "514496677656",
    appId: "1:514496677656:web:13618921d987588d37806d"
  };

  _app = initializeApp(firebaseConfig);

  // Attach commonly used services on the app object for convenience
  _app.__auth = getAuth(_app);
  _app.__db = getFirestore(_app);

  return _app;
}

export function getAuthService(firebaseApp) {
  return firebaseApp.__auth;
}

export function getDbService(firebaseApp) {
  return firebaseApp.__db;
}
