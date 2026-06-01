import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function bumpPostStat(db, postId, field, delta) {
  const ref = doc(db, "posts", postId);
  await updateDoc(ref, { [field]: increment(delta) });
}

export const INITIAL_POST_STATS = {
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
};
