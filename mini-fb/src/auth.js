import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { handleFirebaseError } from "./error-handler.js";

let _currentUser = null;

/**
 * Get current authenticated user
 * @returns {Object|null} Current user object or null
 */
export function getCurrentUser() {
  return _currentUser;
}

/**
 * Ensure user is authenticated, wait for auth state
 * @param {Object} firebaseApp - Firebase app instance
 * @returns {Promise<Object>} Authenticated user
 * @throws {Error} If user is not logged in
 */
export async function ensureAuth(firebaseApp) {
  const auth = getAuth(firebaseApp);

  return await new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      _currentUser = user;
      if (!user) {
        reject(new Error("Not logged in."));
        return;
      }
      resolve(user);
    });
  });
}

/**
 * Get Firebase Auth service instance
 * @param {Object} firebaseApp - Firebase app instance
 * @returns {Object} Auth service
 */
export function getAuthService(firebaseApp) {
  return getAuth(firebaseApp);
}

/**
 * Login user with email and password
 * @param {Object} firebaseApp - Firebase app instance
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Function} showToast - Optional toast notification function
 * @returns {Promise<Object>} Authenticated user
 */
export async function login(firebaseApp, email, password, showToast = null) {
  try {
    const auth = getAuth(firebaseApp);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    _currentUser = cred.user;
    return cred.user;
  } catch (error) {
    handleFirebaseError(error, 'login', showToast);
    throw error;
  }
}

/**
 * Create new user account
 * @param {Object} firebaseApp - Firebase app instance
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Function} showToast - Optional toast notification function
 * @returns {Promise<Object>} Created user
 */
export async function createAccount(firebaseApp, email, password, showToast = null) {
  try {
    const auth = getAuth(firebaseApp);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    _currentUser = cred.user;
    return cred.user;
  } catch (error) {
    handleFirebaseError(error, 'createAccount', showToast);
    throw error;
  }
}

/**
 * Check if user is admin
 * @param {Object} firebaseApp - Firebase app instance
 * @param {string} uid - User ID to check
 * @returns {Promise<boolean>} True if user is admin
 */
export async function isAdmin(firebaseApp, uid) {
  try {
    // Admins are managed via Firestore doc: admins/{uid}
    // If admins/{uid} exists => admin
    const db = getDbService(firebaseApp);
    const ref = doc(db, "admins", uid);
    const snap = await getDoc(ref);
    return snap.exists();
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Send password reset email
 * @param {Object} firebaseApp - Firebase app instance
 * @param {string} email - User email
 * @param {Function} showToast - Optional toast notification function
 * @returns {Promise<void>}
 */
export async function resetPassword(firebaseApp, email, showToast = null) {
  try {
    const auth = getAuth(firebaseApp);
    await sendPasswordResetEmail(auth, email);
    if (showToast) {
      showToast('Password reset email sent', 'success');
    }
  } catch (error) {
    handleFirebaseError(error, 'resetPassword', showToast);
    throw error;
  }
}
