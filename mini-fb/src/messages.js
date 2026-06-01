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
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { createNotificationForMessage } from "./notifications.js";

export function conversationId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export async function getOrCreateConversation(db, otherUid) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");
  if (!otherUid || otherUid === user.uid) throw new Error("Invalid recipient.");

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
  if (!otherUid) throw new Error("Choose someone to message.");

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
      participants: [user.uid, otherUid].sort(),
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

export function listenMyConversations(db, onData, onError) {
  const user = getCurrentUser();
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", user.uid),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(
    q,
    onData,
    (err) => {
      if (onError) onError(err);
    }
  );
}

export function listenMessages(db, convId, onData, onError) {
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    onData,
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function searchProfilesForMessaging(db, searchTerm, limit = 12) {
  const user = getCurrentUser();
  const q = searchTerm.trim().toLowerCase();
  if (!q) return [];

  const snap = await getDocs(collection(db, "profiles"));
  const results = [];
  snap.forEach((docSnap) => {
    if (docSnap.id === user.uid) return;
    const p = docSnap.data();
    const display = (p.displayName || "").toLowerCase();
    const email = (p.email || "").toLowerCase();
    const emailHandle = email.split("@")[0];
    if (display.includes(q) || email.includes(q) || emailHandle.includes(q)) {
      results.push({ uid: docSnap.id, ...p });
    }
  });
  return results.slice(0, limit);
}

export async function getProfileDisplayName(db, uid) {
  const docSnap = await getDoc(doc(db, "profiles", uid));
  if (docSnap.exists()) {
    const p = docSnap.data();
    return p.displayName || p.email || "User";
  }
  return "User";
}

export function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d.innerHTML;
}
