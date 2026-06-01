import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";

function saveId(uid, postId) {
  return `${uid}_${postId}`;
}

export async function toggleSave(firebaseApp, postId) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const ref = doc(db, "saves", saveId(user.uid, postId));
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
    return { saved: false };
  }
  await setDoc(ref, { uid: user.uid, postId, createdAt: new Date() });
  return { saved: true };
}

export async function isPostSaved(firebaseApp, postId) {
  const user = getCurrentUser();
  if (!user) return false;
  const db = getDbService(firebaseApp);
  const snap = await getDoc(doc(db, "saves", saveId(user.uid, postId)));
  return snap.exists();
}

export async function getSavedPostIds(firebaseApp) {
  const user = getCurrentUser();
  if (!user) return [];
  const db = getDbService(firebaseApp);
  const q = query(collection(db, "saves"), where("uid", "==", user.uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().postId).filter(Boolean);
}
