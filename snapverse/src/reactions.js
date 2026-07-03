import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { likeSubcol } from "./likes.js";
import { bumpPostStat } from "./post-stats.js";
import { createNotificationForReaction } from "./notifications.js";

export const REACTIONS = [
  { id: "like", emoji: "👍", label: "Like" },
  { id: "love", emoji: "❤️", label: "Love" },
  { id: "haha", emoji: "😂", label: "Haha" },
  { id: "wow", emoji: "😮", label: "Wow" },
  { id: "sad", emoji: "😢", label: "Sad" },
  { id: "angry", emoji: "😠", label: "Angry" },
];

export function reactionEmoji(id) {
  return REACTIONS.find((r) => r.id === id)?.emoji || "👍";
}

export async function getMyReaction(db, postId, uid) {
  const snap = await getDoc(doc(likeSubcol(db, postId), uid));
  if (!snap.exists()) return null;
  return snap.data().reaction || "like";
}

export async function setReaction(firebaseApp, post, reactionId) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const postId = post.id;
  const ref = doc(likeSubcol(db, postId), user.uid);
  const existing = await getDoc(ref);

  if (existing.exists() && (existing.data().reaction || "like") === reactionId) {
    await deleteDoc(ref);
    await bumpPostStat(db, postId, "likeCount", -1);
    return { active: false, reaction: null };
  }

  const wasNew = !existing.exists();
  await setDoc(ref, { reaction: reactionId, createdAt: new Date() });
  if (wasNew) {
    await bumpPostStat(db, postId, "likeCount", 1);
    if (post.authorUid && post.authorUid !== user.uid) {
      await createNotificationForReaction(firebaseApp, {
        postId,
        actorUid: user.uid,
        authorUid: post.authorUid,
        actorEmail: user.email,
        reactionId,
      });
    }
  }
  return { active: true, reaction: reactionId };
}
