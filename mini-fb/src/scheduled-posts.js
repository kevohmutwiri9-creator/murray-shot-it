import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
  deleteDoc,
  getDoc,
  Timestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getCurrentUser } from "./auth.js";

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

// Post scheduling improvements
export async function schedulePost(db, postData, scheduledFor) {
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in to schedule posts.");
  
  const scheduledDate = new Date(scheduledFor);
  if (scheduledDate <= new Date()) {
    throw new Error("Scheduled time must be in the future.");
  }
  
  const postRef = await addDoc(collection(db, "posts"), {
    ...postData,
    status: "scheduled",
    scheduledFor: Timestamp.fromDate(scheduledDate),
    authorUid: user.uid,
    createdAt: serverTimestamp(),
  });
  
  return postRef.id;
}

export async function cancelScheduledPost(db, postId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in to cancel scheduled posts.");
  
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  
  if (!postSnap.exists()) {
    throw new Error("Post not found");
  }
  
  const postData = postSnap.data();
  if (postData.authorUid !== user.uid) {
    throw new Error("You can only cancel your own scheduled posts");
  }
  
  if (postData.status !== "scheduled") {
    throw new Error("Post is not scheduled");
  }
  
  await deleteDoc(postRef);
}

export async function reschedulePost(db, postId, newScheduledFor) {
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in to reschedule posts.");
  
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  
  if (!postSnap.exists()) {
    throw new Error("Post not found");
  }
  
  const postData = postSnap.data();
  if (postData.authorUid !== user.uid) {
    throw new Error("You can only reschedule your own posts");
  }
  
  if (postData.status !== "scheduled") {
    throw new Error("Post is not scheduled");
  }
  
  const scheduledDate = new Date(newScheduledFor);
  if (scheduledDate <= new Date()) {
    throw new Error("Scheduled time must be in the future.");
  }
  
  await updateDoc(postRef, {
    scheduledFor: Timestamp.fromDate(scheduledDate),
  });
}

export async function getScheduledPosts(db, uid) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("authorUid", "==", uid),
    where("status", "==", "scheduled")
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const timeA = a.scheduledFor ? new Date(a.scheduledFor).getTime() : Infinity;
      const timeB = b.scheduledFor ? new Date(b.scheduledFor).getTime() : Infinity;
      return timeA - timeB;
    });
}

export function subscribeToScheduledPosts(db, uid, callback) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("authorUid", "==", uid),
    where("status", "==", "scheduled")
  );
  
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const timeA = a.scheduledFor ? new Date(a.scheduledFor).getTime() : Infinity;
        const timeB = b.scheduledFor ? new Date(b.scheduledFor).getTime() : Infinity;
        return timeA - timeB;
      });
    callback(posts);
  });
}

export async function getScheduledPostCount(db, uid) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("authorUid", "==", uid),
    where("status", "==", "scheduled")
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
}

export function formatScheduledTime(scheduledFor) {
  const date = new Date(scheduledFor);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffDays > 0) {
    return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else if (diffMinutes > 0) {
    return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  } else {
    return "soon";
  }
}
