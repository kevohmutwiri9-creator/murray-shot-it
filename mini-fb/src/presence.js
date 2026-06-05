import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const HEARTBEAT_MS = 45 * 1000;
const TYPING_TTL_MS = 5000;

const presenceCache = new Map();
const presenceListeners = new Map();

export function parsePresence(data) {
  if (!data) return { online: false, label: "Offline", lastSeen: null };

  const lastActive = data.lastActiveAt?.toDate?.() || null;
  const recentlyActive =
    lastActive && Date.now() - lastActive.getTime() < ONLINE_THRESHOLD_MS;
  const online = data.online === true && recentlyActive;

  if (online) return { online: true, label: "Online", lastSeen: lastActive };
  if (lastActive) {
    return { online: false, label: formatLastSeen(lastActive), lastSeen: lastActive };
  }
  return { online: false, label: "Offline", lastSeen: null };
}

export function formatLastSeen(date) {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Active just now";
  if (diff < 3_600_000) return `Active ${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `Active ${Math.floor(diff / 3_600_000)}h ago`;
  return `Last seen ${date.toLocaleDateString()}`;
}

export function isTypingRecent(typingAt) {
  if (!typingAt) return false;
  const date = typingAt?.toDate?.() || null;
  if (!date) return false;
  return Date.now() - date.getTime() < TYPING_TTL_MS;
}

let heartbeatTimer = null;
let startedForUid = null;

export function startPresence(db, uid) {
  if (!db || !uid || startedForUid === uid) return;
  startedForUid = uid;

  const ref = doc(db, "presence", uid);

  const heartbeat = () => {
    setDoc(
      ref,
      { uid, online: true, lastActiveAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});
  };

  const goOffline = () => {
    setDoc(
      ref,
      { online: false, lastActiveAt: serverTimestamp() },
      { merge: true }
    ).catch(() => {});
  };

  heartbeat();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") goOffline();
    else heartbeat();
  });
  window.addEventListener("beforeunload", goOffline);
}

export function subscribePresence(db, uid, callback) {
  if (!uid) return () => {};

  if (!presenceListeners.has(uid)) {
    presenceListeners.set(uid, new Set());
    onSnapshot(
      doc(db, "presence", uid),
      (snap) => {
        const state = parsePresence(snap.data());
        presenceCache.set(uid, state);
        presenceListeners.get(uid)?.forEach((cb) => cb(state));
      },
      () => {
        const state = { online: false, label: "Offline", lastSeen: null };
        presenceCache.set(uid, state);
        presenceListeners.get(uid)?.forEach((cb) => cb(state));
      }
    );
  }

  if (presenceCache.has(uid)) callback(presenceCache.get(uid));
  presenceListeners.get(uid).add(callback);

  return () => presenceListeners.get(uid)?.delete(callback);
}

export function presenceDotClass(online) {
  return online ? "bg-emerald-500" : "bg-gray-400";
}

export function messageStatusMeta(message) {
  if (message.read) {
    return { ticks: "✓✓", className: "text-sky-300", label: "Seen" };
  }
  if (message.delivered) {
    return { ticks: "✓✓", className: "text-white/60", label: "Delivered" };
  }
  return { ticks: "✓", className: "text-white/60", label: "Sent" };
}
