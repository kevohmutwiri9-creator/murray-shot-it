import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { createNotificationForShare } from "./notifications.js";

export function sharesCol(db, postId) {
  return collection(db, "posts", postId, "shares");
}

export async function toggleShare(firebaseApp, post) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const postId = post.id;
  const col = sharesCol(db, postId);
  const shareDocRef = doc(col, user.uid);

  const existing = await getDoc(shareDocRef);
  const actorUid = user.uid;
  const authorUid = post.authorUid;

  if (existing.exists()) {
    await deleteDoc(shareDocRef);
    return { shared: false };
  }

  await setDoc(shareDocRef, { createdAt: serverTimestamp() });

  await createNotificationForShare(firebaseApp, { postId, actorUid, authorUid });

  return { shared: true };
}

export async function countSharesForPost(firebaseApp, postId) {
  // UI helper (counts via direct get). For v1 we use count only on render time.
  const db = getDbService(firebaseApp);
  const col = collection(db, "posts", postId, "shares");
  const snap = await (await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")).getDocs(col);
  return snap.size;
}
