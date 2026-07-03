import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getCurrentUser } from "./auth.js";

export async function reportUser(db, targetUid, reason) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");
  if (!targetUid || targetUid === user.uid) throw new Error("Invalid user.");
  if (!reason?.trim()) throw new Error("Please provide a reason.");

  await addDoc(collection(db, "userFlags"), {
    targetUid,
    reporterUid: user.uid,
    reporterEmail: user.email || null,
    reason: reason.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
  });
}
