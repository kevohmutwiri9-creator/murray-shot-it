import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let handleToUid = new Map();

export function profileUrl(uid) {
  if (!uid) return "/mini-fb/profile.html";
  return `/mini-fb/profile.html?uid=${encodeURIComponent(uid)}`;
}

export async function loadProfilesCache(db) {
  handleToUid = new Map();
  const snap = await getDocs(collection(db, "profiles"));
  snap.forEach((docSnap) => {
    const p = docSnap.data();
    const uid = docSnap.id;
    const display = (p.displayName || "").trim().toLowerCase();
    const emailHandle = (p.email || "").split("@")[0].trim().toLowerCase();
    if (display) handleToUid.set(display, uid);
    if (emailHandle) handleToUid.set(emailHandle, uid);
  });
}

export function uidForHandle(handle) {
  return handleToUid.get(String(handle || "").toLowerCase()) || null;
}

export function profileUrlForHandle(handle) {
  const uid = uidForHandle(handle);
  return uid ? profileUrl(uid) : `/mini-fb/search.html?q=${encodeURIComponent(handle)}`;
}
