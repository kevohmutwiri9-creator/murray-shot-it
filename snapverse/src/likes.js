import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { createNotificationForLike } from "./notifications.js";
import { bumpPostStat } from "./post-stats.js";

export function likeSubcol(db, postId) {
  return collection(db, "posts", postId, "likes");
}

export async function toggleLike(firebaseApp, post) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const postId = post.id;
  const likesCol = likeSubcol(db, postId);
  const likeDocRef = doc(likesCol, user.uid);

  const existing = await getDoc(likeDocRef);

  // posts author should not receive notifications for their own likes (optional)
  const actorUid = user.uid;
  const authorUid = post.authorUid;

  if (existing.exists()) {
    await deleteDoc(likeDocRef);
    await bumpPostStat(db, postId, "likeCount", -1);
    return { liked: false };
  }

  await setDoc(likeDocRef, { createdAt: new Date() });
  await bumpPostStat(db, postId, "likeCount", 1);
  if (authorUid && authorUid !== actorUid) {
    await createNotificationForLike(firebaseApp, {
      postId,
      actorUid,
      authorUid,
      actorEmail: user.email,
    });
  }
  return { liked: true };
}

export function isLikedByMe(likesArray, myUid) {
  if (!likesArray) return false;
  return likesArray.includes(myUid);
}
