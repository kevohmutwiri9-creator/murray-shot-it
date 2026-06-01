import { doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";

export async function deleteMyPost(firebaseApp, postId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const db = getDbService(firebaseApp);
  const postRef = doc(db, "posts", postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) throw new Error("Post not found.");
  if (snap.data().authorUid !== user.uid) throw new Error("You can only delete your own posts.");

  await deleteDoc(postRef);
}
