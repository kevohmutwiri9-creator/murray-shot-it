import { collection, addDoc, serverTimestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { INITIAL_POST_STATS } from "./post-stats.js";
import { showToast } from "./ui.js";

export async function repostToFeed(firebaseApp, originalPost, caption = "") {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const db = getDbService(firebaseApp);
  const text = caption.trim() || `Reposted: ${originalPost.title || ""}`.trim();

  await addDoc(collection(db, "posts"), {
    title: originalPost.title || "Repost",
    text,
    mediaUrl: originalPost.mediaUrl || null,
    mediaType: originalPost.mediaType || null,
    authorUid: user.uid,
    authorEmail: user.email || null,
    createdAt: serverTimestamp(),
    status: "published",
    type: "repost",
    originalPostId: originalPost.id,
    originalAuthorUid: originalPost.authorUid || null,
    visibility: "public",
    ...INITIAL_POST_STATS,
  });

  showToast("Shared to your feed!", "success");
}

export async function fetchPost(db, postId) {
  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
