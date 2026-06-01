import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getCurrentUser } from "./auth.js";

export function blockDocId(blockerUid, blockedUid) {
  return `${blockerUid}_${blockedUid}`;
}

export async function blockUser(db, blockedUid) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");
  if (!blockedUid || blockedUid === user.uid) throw new Error("Invalid user.");
  await setDoc(doc(db, "blocks", blockDocId(user.uid, blockedUid)), {
    blockerUid: user.uid,
    blockedUid,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(db, blockedUid) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  await deleteDoc(doc(db, "blocks", blockDocId(user.uid, blockedUid)));
}

export async function isBlocked(db, blockerUid, blockedUid) {
  if (!blockerUid || !blockedUid) return false;
  try {
    const snap = await getDoc(doc(db, "blocks", blockDocId(blockerUid, blockedUid)));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function getBlockedUids(db, uid) {
  const snap = await getDocs(query(collection(db, "blocks"), where("blockerUid", "==", uid)));
  const set = new Set();
  snap.forEach((d) => {
    const b = d.data().blockedUid;
    if (b) set.add(b);
  });
  return set;
}

export function filterBlockedPosts(posts, blockedSet) {
  if (!blockedSet?.size) return posts;
  return posts.filter((p) => !blockedSet.has(p.authorUid));
}
