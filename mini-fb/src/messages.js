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
  updateDoc,
  writeBatch,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { createNotificationForMessage } from "./notifications.js";
import { checkRateLimit, recordRateLimit } from "./rate-limit.js";

export function conversationId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export function isGroupConversationId(id) {
  return String(id || "").startsWith("group_");
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
      type: "dm",
      participants: [user.uid, otherUid].sort(),
      updatedAt: serverTimestamp(),
      unreadCounts: {},
    },
    { merge: true }
  );
  return id;
}

export async function createGroupConversation(db, participantUids, title) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");
  const participants = [...new Set([user.uid, ...participantUids])].sort();
  if (participants.length < 3) throw new Error("Pick at least 2 other people for a group.");

  const id = `group_${crypto.randomUUID().slice(0, 12)}`;
  await setDoc(doc(db, "conversations", id), {
    type: "group",
    title: (title || "Group chat").trim().slice(0, 60),
    participants,
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    unreadCounts: {},
  });
  return id;
}

async function bumpUnreadForRecipients(db, convId, senderUid, participantUids) {
  const updates = { updatedAt: serverTimestamp() };
  participantUids.forEach((p) => {
    if (p !== senderUid) updates[`unreadCounts.${p}`] = increment(1);
  });
  await setDoc(doc(db, "conversations", convId), updates, { merge: true });
}

export async function markConversationRead(db, convId) {
  const user = getCurrentUser();
  if (!user) return;

  await setDoc(
    doc(db, "conversations", convId),
    { [`unreadCounts.${user.uid}`]: 0, [`readAt.${user.uid}`]: serverTimestamp() },
    { merge: true }
  );

  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  let n = 0;
  snap.forEach((d) => {
    const m = d.data();
    if (m.senderUid !== user.uid && !m.read) {
      batch.update(d.ref, { read: true, delivered: true });
      n++;
    }
  });
  if (n) await batch.commit();
}

export async function markMessagesDelivered(db, convId) {
  const user = getCurrentUser();
  if (!user) return;

  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  let n = 0;
  snap.forEach((d) => {
    const m = d.data();
    if (m.senderUid !== user.uid && !m.delivered) {
      batch.update(d.ref, { delivered: true });
      n++;
    }
  });
  if (n) await batch.commit();
}

export async function setTyping(db, convId, isTyping) {
  const user = getCurrentUser();
  if (!user || !convId) return;

  await setDoc(
    doc(db, "conversations", convId),
    { [`typing.${user.uid}`]: isTyping ? serverTimestamp() : null },
    { merge: true }
  );
}

export async function sendMessage(firebaseApp, target, payload) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  checkRateLimit("message", user.uid);

  let convId;
  let recipientUids = [];

  if (typeof target === "string" && isGroupConversationId(target)) {
    convId = target;
    const convSnap = await getDoc(doc(db, "conversations", convId));
    if (!convSnap.exists()) throw new Error("Conversation not found.");
    const data = convSnap.data();
    if (!data.participants?.includes(user.uid)) throw new Error("Not in this conversation.");
    recipientUids = data.participants.filter((p) => p !== user.uid);
  } else if (typeof target === "string") {
    const otherUid = target;
    convId = await getOrCreateConversation(db, otherUid);
    recipientUids = [otherUid];
  } else {
    throw new Error("Invalid message target.");
  }

  const text = (payload.text || "").trim();
  const imageUrl = payload.imageUrl || null;
  const postLink = payload.postLink || null;

  if (!text && !imageUrl && !postLink) throw new Error("Message cannot be empty.");

  const preview = text || (imageUrl ? "📷 Photo" : "🔗 Shared a post");

  await addDoc(collection(db, "conversations", convId, "messages"), {
    senderUid: user.uid,
    senderEmail: user.email || null,
    text: text || null,
    imageUrl,
    postLink,
    createdAt: serverTimestamp(),
    read: false,
    delivered: false,
  });

  const convSnap = await getDoc(doc(db, "conversations", convId));
  const participants = convSnap.data()?.participants || recipientUids.concat(user.uid);

  await setDoc(
    doc(db, "conversations", convId),
    {
      participants,
      lastMessage: preview.slice(0, 120),
      lastSenderUid: user.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await bumpUnreadForRecipients(db, convId, user.uid, participants);

  recordRateLimit("message", user.uid);

  for (const toUid of recipientUids) {
    if (toUid !== user.uid) {
      await createNotificationForMessage(firebaseApp, {
        toUid,
        actorUid: user.uid,
        actorEmail: user.email,
        conversationId: convId,
      });
    }
  }
}

export function listenMyConversations(db, onData, onError) {
  const user = getCurrentUser();
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", user.uid),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(q, onData, (err) => {
    if (onError) onError(err);
  });
}

export function listenMessages(db, convId, onData, onError) {
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, onData, (err) => {
    if (onError) onError(err);
  });
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
