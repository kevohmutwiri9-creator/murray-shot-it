import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/** Publish scheduled posts whose time has passed */
export async function publishDueScheduledPosts(db) {
  const postsCol = collection(db, "posts");
  const q = query(postsCol, where("status", "==", "scheduled"));
  const snapshot = await getDocs(q);
  const now = Date.now();

  const updates = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const scheduledFor = data.scheduledFor ? new Date(data.scheduledFor).getTime() : null;
    if (scheduledFor && scheduledFor <= now) {
      updates.push(
        updateDoc(doc(db, "posts", docSnap.id), {
          status: "published",
          publishedAt: serverTimestamp(),
        })
      );
    }
  });

  await Promise.all(updates);
  return updates.length;
}

export function isPostVisible(post) {
  const status = post.status || "published";
  if (status === "published") return true;
  if (status === "scheduled") {
    const when = post.scheduledFor ? new Date(post.scheduledFor).getTime() : Infinity;
    return when <= Date.now();
  }
  return false;
}
