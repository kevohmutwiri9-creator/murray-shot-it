import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";

export async function createNotificationForLike(firebaseApp, { postId, actorUid, authorUid }) {
  const db = getDbService(firebaseApp);

  // Avoid sending notifications to self
  if (!authorUid || authorUid === actorUid) return;

  await addDoc(collection(db, "notifications"), {
    toUid: authorUid,
    type: "like",
    actorUid,
    postId,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function createNotificationForComment(firebaseApp, { postId, actorUid, authorUid }) {
  const db = getDbService(firebaseApp);
  if (!authorUid || authorUid === actorUid) return;

  await addDoc(collection(db, "notifications"), {
    toUid: authorUid,
    type: "comment",
    actorUid,
    postId,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function createNotificationForShare(firebaseApp, { postId, actorUid, authorUid }) {
  const db = getDbService(firebaseApp);
  if (!authorUid || authorUid === actorUid) return;

  await addDoc(collection(db, "notifications"), {
    toUid: authorUid,
    type: "share",
    actorUid,
    postId,
    createdAt: serverTimestamp(),
    read: false,
  });
}
