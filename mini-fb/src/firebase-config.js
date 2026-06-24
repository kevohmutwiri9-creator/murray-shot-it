import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let _app;

/**
 * Get Firebase configuration from environment variables or fallback to defaults
 * In production, these should be set via environment variables
 * @returns {Object} Firebase configuration object
 */
function getFirebaseConfig() {
  // Check for Vite environment variables (development/production with Vite)
  if (import.meta.env) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC8fJn-09U4I_8YL6YTSyx4YV6wg1YMj7U",
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "snapverse-32683.firebaseapp.com",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "snapverse-32683",
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "snapverse-32683.firebasestorage.app",
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "514496677656",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:514496677656:web:13618921d987588d37806d"
    };
  }

  // Fallback for non-Vite environments (static hosting)
  return {
    apiKey: "AIzaSyC8fJn-09U4I_8YL6YTSyx4YV6wg1YMj7U",
    authDomain: "snapverse-32683.firebaseapp.com",
    projectId: "snapverse-32683",
    storageBucket: "snapverse-32683.firebasestorage.app",
    messagingSenderId: "514496677656",
    appId: "1:514496677656:web:13618921d987588d37806d"
  };
}

/**
 * Initialize Firebase app (singleton pattern)
 * @returns {Object} Firebase app instance with attached auth and db services
 */
export function initFirebase() {
  if (_app) return _app;

  const firebaseConfig = getFirebaseConfig();

  _app = initializeApp(firebaseConfig);

  // Attach commonly used services on the app object for convenience
  _app.__auth = getAuth(_app);
  _app.__db = getFirestore(_app);

  return _app;
}

/**
 * Get Firebase Auth service from app instance
 * @param {Object} firebaseApp - Firebase app instance
 * @returns {Object} Firebase Auth service
 */
export function getAuthService(firebaseApp) {
  return firebaseApp.__auth;
}

/**
 * Get Firestore database service from app instance
 * @param {Object} firebaseApp - Firebase app instance
 * @returns {Object} Firestore database service
 */
export function getDbService(firebaseApp) {
  return firebaseApp.__db;
}
