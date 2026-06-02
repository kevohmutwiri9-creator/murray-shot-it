import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function logAdminAction(db, actor, action, details = {}) {
  if (!db || !actor?.uid) return;
  try {
    await addDoc(collection(db, "adminActions"), {
      actorUid: actor.uid,
      actorEmail: actor.email || null,
      action,
      details,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Avoid breaking moderation actions if audit write fails.
  }
}
