import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { createNotificationForComment } from "./notifications.js";

export function commentsCol(db, postId) {
  return collection(db, "posts", postId, "comments");
}

export async function addComment(firebaseApp, post, text, parentCommentId = null) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const t = String(text ?? "").trim();
  if (!t) throw new Error("Comment cannot be empty.");

  const postId = post.id;

  await addDoc(commentsCol(db, postId), {
    text: t,
    authorUid: user.uid,
    authorEmail: user.email || null,
    parentCommentId,
    createdAt: serverTimestamp(),
  });

  // notify post author
  const authorUid = post.authorUid;
  await createNotificationForComment(firebaseApp, {
    postId,
    actorUid: user.uid,
    authorUid,
  });
}

export function bindCommentsCount(firebaseApp, { post, countEl }) {
  const db = getDbService(firebaseApp);
  const postId = post.id;
  const col = commentsCol(db, postId);

  // Lightweight approach: listen to latest comments limited; for count we rely on snapshot size
  const q = query(col, orderBy("createdAt", "desc"), limit(200));

  return onSnapshot(q, (snap) => {
    // Not exact count for >200, but good enough for UI v1
    countEl.textContent = `${snap.size}`;
  });
}
