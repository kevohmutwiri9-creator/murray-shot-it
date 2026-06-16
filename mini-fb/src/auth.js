import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";

let _currentUser = null;

export function getCurrentUser() {
  return _currentUser;
}

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

export function getAuthService(firebaseApp) {
  return getAuth(firebaseApp);
}

export async function login(firebaseApp, email, password) {
  const auth = getAuth(firebaseApp);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  _currentUser = cred.user;
  return cred.user;
}

export async function createAccount(firebaseApp, email, password) {
  const auth = getAuth(firebaseApp);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  _currentUser = cred.user;
  return cred.user;
}

export async function isAdmin(firebaseApp, uid) {
  // Admins are managed via Firestore doc: admins/{uid}
  // If admins/{uid} exists => admin
  const db = getDbService(firebaseApp);
  const ref = doc(db, "admins", uid);
  const snap = await getDoc(ref);
  return snap.exists();
}

export async function resetPassword(firebaseApp, email) {
  const auth = getAuth(firebaseApp);
  await sendPasswordResetEmail(auth, email);
}
