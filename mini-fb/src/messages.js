import {
  collection,
  doc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { createNotificationForMessage } from "./notifications.js";

export function conversationId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export async function getOrCreateConversation(db, otherUid) {
  const user = getCurrentUser();
  const id = conversationId(user.uid, otherUid);
  const ref = doc(db, "conversations", id);
  await setDoc(
    ref,
    {
      participants: [user.uid, otherUid].sort(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return id;
}

export async function sendMessage(firebaseApp, otherUid, text) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  const t = text.trim();
  if (!t) throw new Error("Message cannot be empty.");

  const convId = await getOrCreateConversation(db, otherUid);
  await addDoc(collection(db, "conversations", convId, "messages"), {
    senderUid: user.uid,
    senderEmail: user.email || null,
    text: t,
    createdAt: serverTimestamp(),
    read: false,
  });

  await setDoc(
    doc(db, "conversations", convId),
    {
      lastMessage: t.slice(0, 120),
      lastSenderUid: user.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (otherUid !== user.uid) {
    await createNotificationForMessage(firebaseApp, {
      toUid: otherUid,
      actorUid: user.uid,
      actorEmail: user.email,
      conversationId: convId,
    });
  }
}

export function listenMyConversations(db, callback) {
  const user = getCurrentUser();
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", user.uid),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(q, callback, () => callback({ docs: [] }));
}

export function listenMessages(db, convId, callback) {
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, callback);
}

export async function findProfileByUsername(db, username) {
  const q = query(collection(db, "profiles"));
  const snap = await getDocs(q);
  const lower = username.toLowerCase();
  for (const d of snap.docs) {
    const p = d.data();
    const name = (p.displayName || "").toLowerCase();
    const email = (p.email || "").split("@")[0].toLowerCase();
    if (name === lower || email === lower) return { uid: d.id, ...p };
  }
  return null;
}
