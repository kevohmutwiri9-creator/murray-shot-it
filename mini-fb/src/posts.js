import { doc, getDoc, deleteDoc, updateDoc, increment, collection, query, where, getDocs, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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

// Post analytics/views functionality
export async function recordPostView(db, postId) {
  const user = getCurrentUser();
  if (!user) return;
  
  const postRef = doc(db, "posts", postId);
  const viewRef = doc(db, "postViews", `${user.uid}_${postId}`);
  const viewSnap = await getDoc(viewRef);
  
  if (!viewSnap.exists()) {
    await updateDoc(postRef, { viewCount: increment(1) });
    await setDoc(viewRef, {
      uid: user.uid,
      postId,
      viewedAt: new Date(),
    });
  }
}

export async function getPostAnalytics(db, postId) {
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  
  if (!postSnap.exists()) {
    throw new Error("Post not found");
  }
  
  const postData = postSnap.data();
  
  // Get reaction counts
  const reactionsCol = collection(db, "reactions");
  const reactionsQ = query(reactionsCol, where("postId", "==", postId));
  const reactionsSnap = await getDocs(reactionsQ);
  const reactionCount = reactionsSnap.size;
  
  // Get comment count
  const commentsCol = collection(db, "posts", postId, "comments");
  const commentsSnap = await getDocs(commentsCol);
  const commentCount = commentsSnap.size;
  
  // Get share count
  const sharesCol = collection(db, "shares");
  const sharesQ = query(sharesCol, where("postId", "==", postId));
  const sharesSnap = await getDocs(sharesQ);
  const shareCount = sharesSnap.size;
  
  return {
    viewCount: postData.viewCount || 0,
    reactionCount,
    commentCount,
    shareCount,
    engagementRate: calculateEngagementRate(postData.viewCount || 0, reactionCount, commentCount, shareCount),
  };
}

export function calculateEngagementRate(views, reactions, comments, shares) {
  if (views === 0) return 0;
  const totalEngagement = reactions + comments + shares;
  return ((totalEngagement / views) * 100).toFixed(2);
}

export async function getUserPostAnalytics(db, uid) {
  const postsCol = collection(db, "posts");
  const q = query(postsCol, where("authorUid", "==", uid));
  const snapshot = await getDocs(q);
  
  let totalViews = 0;
  let totalReactions = 0;
  let totalComments = 0;
  let totalShares = 0;
  const postCount = snapshot.size;
  
  for (const docSnap of snapshot.docs) {
    const analytics = await getPostAnalytics(db, docSnap.id);
    totalViews += analytics.viewCount;
    totalReactions += analytics.reactionCount;
    totalComments += analytics.commentCount;
    totalShares += analytics.shareCount;
  }
  
  return {
    postCount,
    totalViews,
    totalReactions,
    totalComments,
    totalShares,
    averageViews: postCount > 0 ? Math.round(totalViews / postCount) : 0,
    averageEngagementRate: calculateEngagementRate(totalViews, totalReactions, totalComments, totalShares),
  };
}

export function subscribeToPostAnalytics(db, postId, callback) {
  const postRef = doc(db, "posts", postId);
  
  return onSnapshot(postRef, async (postSnap) => {
    if (!postSnap.exists()) {
      callback(null);
      return;
    }
    
    const analytics = await getPostAnalytics(db, postId);
    callback(analytics);
  });
}

export async function getTopPerformingPosts(db, uid, limit = 5) {
  const postsCol = collection(db, "posts");
  const q = query(postsCol, where("authorUid", "==", uid));
  const snapshot = await getDocs(q);
  
  const postsWithAnalytics = [];
  
  for (const docSnap of snapshot.docs) {
    const analytics = await getPostAnalytics(db, docSnap.id);
    postsWithAnalytics.push({
      id: docSnap.id,
      ...docSnap.data(),
      analytics,
    });
  }
  
  return postsWithAnalytics
    .sort((a, b) => b.analytics.viewCount - a.analytics.viewCount)
    .slice(0, limit);
}
