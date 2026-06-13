import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getCurrentUser } from "./auth.js";

// Explore page improvements - trending and categories

export async function getTrendingPosts(db, limitCount = 10) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("status", "==", "published"),
    orderBy("viewCount", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getTrendingHashtags(db, limitCount = 10) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("status", "==", "published"),
    orderBy("viewCount", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  
  const hashtagCounts = new Map();
  
  snapshot.docs.forEach(docSnap => {
    const post = docSnap.data();
    const content = post.content || "";
    const hashtags = content.match(/#[\w-]+/g) || [];
    
    hashtags.forEach(hashtag => {
      const normalized = hashtag.toLowerCase();
      hashtagCounts.set(normalized, (hashtagCounts.get(normalized) || 0) + 1);
    });
  });
  
  return Array.from(hashtagCounts.entries())
    .map(([hashtag, count]) => ({ hashtag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limitCount);
}

export async function getPostsByCategory(db, category, limitCount = 20) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("status", "==", "published"),
    where("category", "==", category),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getPopularCategories(db) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("status", "==", "published"),
    where("category", "!=", null),
    limit(500)
  );
  const snapshot = await getDocs(q);
  
  const categoryCounts = new Map();
  
  snapshot.docs.forEach(docSnap => {
    const post = docSnap.data();
    if (post.category) {
      categoryCounts.set(post.category, (categoryCounts.get(post.category) || 0) + 1);
    }
  });
  
  return Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getRecommendedPosts(db, uid, limitCount = 20) {
  const user = getCurrentUser();
  if (!user) return [];
  
  // Get posts from users the current user follows
  const followsCol = collection(db, "followers");
  const followsQ = query(followsCol, where("followerUid", "==", uid));
  const followsSnap = await getDocs(followsQ);
  const followingUids = followsSnap.docs.map(d => d.data().followingUid);
  
  if (followingUids.length === 0) {
    return getTrendingPosts(db, limitCount);
  }
  
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("status", "==", "published"),
    where("authorUid", "in", followingUids.slice(0, 10)),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getRecentPosts(db, limitCount = 20) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("status", "==", "published"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function subscribeToTrendingPosts(db, limitCount = 10, callback) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("status", "==", "published"),
    orderBy("viewCount", "desc"),
    limit(limitCount)
  );
  
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(posts);
  });
}

export function subscribeToTrendingHashtags(db, limitCount = 10, callback) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("status", "==", "published"),
    orderBy("viewCount", "desc"),
    limit(100)
  );
  
  return onSnapshot(q, (snapshot) => {
    const hashtagCounts = new Map();
    
    snapshot.docs.forEach(docSnap => {
      const post = docSnap.data();
      const content = post.content || "";
      const hashtags = content.match(/#[\w-]+/g) || [];
      
      hashtags.forEach(hashtag => {
        const normalized = hashtag.toLowerCase();
        hashtagCounts.set(normalized, (hashtagCounts.get(normalized) || 0) + 1);
      });
    });
    
    const trending = Array.from(hashtagCounts.entries())
      .map(([hashtag, count]) => ({ hashtag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limitCount);
    
    callback(trending);
  });
}

export async function searchPosts(db, searchTerm, limitCount = 20) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("status", "==", "published"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  
  const searchLower = searchTerm.toLowerCase();
  
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(post => {
      const content = (post.content || "").toLowerCase();
      return content.includes(searchLower);
    })
    .slice(0, limitCount);
}

export async function searchUsers(db, searchTerm, limitCount = 20) {
  const usersCol = collection(db, "users");
  const q = query(usersCol, limit(100));
  const snapshot = await getDocs(q);
  
  const searchLower = searchTerm.toLowerCase();
  
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(user => {
      const email = (user.email || "").toLowerCase();
      const displayName = (user.displayName || "").toLowerCase();
      return email.includes(searchLower) || displayName.includes(searchLower);
    })
    .slice(0, limitCount);
}

export async function searchHashtags(db, searchTerm, limitCount = 20) {
  const postsCol = collection(db, "posts");
  const q = query(
    postsCol,
    where("status", "==", "published"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  
  const searchLower = searchTerm.toLowerCase();
  const hashtagSet = new Set();
  
  snapshot.docs.forEach(docSnap => {
    const post = docSnap.data();
    const content = post.content || "";
    const hashtags = content.match(/#[\w-]+/g) || [];
    
    hashtags.forEach(hashtag => {
      if (hashtag.toLowerCase().includes(searchLower)) {
        hashtagSet.add(hashtag);
      }
    });
  });
  
  return Array.from(hashtagSet).slice(0, limitCount);
}

export async function createCategory(db, name, emoji, description = "") {
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in to create categories.");
  
  const categoryRef = doc(collection(db, "categories"));
  await setDoc(categoryRef, {
    id: categoryRef.id,
    name,
    emoji,
    description,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
  
  return categoryRef.id;
}

export async function getCategories(db) {
  const categoriesCol = collection(db, "categories");
  const snapshot = await getDocs(categoriesCol);
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function subscribeToCategories(db, callback) {
  const categoriesCol = collection(db, "categories");
  return onSnapshot(categoriesCol, (snapshot) => {
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(categories);
  });
}
