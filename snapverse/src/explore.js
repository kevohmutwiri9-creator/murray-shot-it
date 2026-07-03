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

// Search filters and sorting
export async function searchPostsWithFilters(db, options = {}) {
  const {
    searchTerm = "",
    category = null,
    minViews = 0,
    maxViews = null,
    dateFrom = null,
    dateTo = null,
    authorUid = null,
    sortBy = "createdAt",
    sortOrder = "desc",
    limitCount = 20,
  } = options;
  
  const postsCol = collection(db, "posts");
  let q = query(postsCol, where("status", "==", "published"), limit(100));
  const snapshot = await getDocs(q);
  
  let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Apply search term filter
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    posts = posts.filter(post => {
      const content = (post.content || "").toLowerCase();
      return content.includes(searchLower);
    });
  }
  
  // Apply category filter
  if (category) {
    posts = posts.filter(post => post.category === category);
  }
  
  // Apply author filter
  if (authorUid) {
    posts = posts.filter(post => post.authorUid === authorUid);
  }
  
  // Apply view count filters
  if (minViews > 0) {
    posts = posts.filter(post => (post.viewCount || 0) >= minViews);
  }
  if (maxViews !== null) {
    posts = posts.filter(post => (post.viewCount || 0) <= maxViews);
  }
  
  // Apply date filters
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    posts = posts.filter(post => {
      const createdAt = post.createdAt?.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
      return createdAt >= fromDate;
    });
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    posts = posts.filter(post => {
      const createdAt = post.createdAt?.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
      return createdAt <= toDate;
    });
  }
  
  // Apply sorting
  posts.sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case "viewCount":
        aValue = a.viewCount || 0;
        bValue = b.viewCount || 0;
        break;
      case "reactionCount":
        aValue = a.reactionCount || 0;
        bValue = b.reactionCount || 0;
        break;
      case "commentCount":
        aValue = a.commentCount || 0;
        bValue = b.commentCount || 0;
        break;
      case "createdAt":
      default:
        aValue = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
        bValue = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
        break;
    }
    
    if (sortOrder === "asc") {
      return aValue - bValue;
    } else {
      return bValue - aValue;
    }
  });
  
  return posts.slice(0, limitCount);
}

export async function searchUsersWithFilters(db, options = {}) {
  const {
    searchTerm = "",
    minFollowers = 0,
    maxFollowers = null,
    sortBy = "email",
    sortOrder = "asc",
    limitCount = 20,
  } = options;
  
  const usersCol = collection(db, "users");
  const q = query(usersCol, limit(100));
  const snapshot = await getDocs(q);
  
  let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Apply search term filter
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    users = users.filter(user => {
      const email = (user.email || "").toLowerCase();
      const displayName = (user.displayName || "").toLowerCase();
      return email.includes(searchLower) || displayName.includes(searchLower);
    });
  }
  
  // Apply follower count filters
  if (minFollowers > 0) {
    users = users.filter(user => (user.followerCount || 0) >= minFollowers);
  }
  if (maxFollowers !== null) {
    users = users.filter(user => (user.followerCount || 0) <= maxFollowers);
  }
  
  // Apply sorting
  users.sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case "followerCount":
        aValue = a.followerCount || 0;
        bValue = b.followerCount || 0;
        break;
      case "followingCount":
        aValue = a.followingCount || 0;
        bValue = b.followingCount || 0;
        break;
      case "displayName":
        aValue = (a.displayName || "").toLowerCase();
        bValue = (b.displayName || "").toLowerCase();
        break;
      case "email":
      default:
        aValue = (a.email || "").toLowerCase();
        bValue = (b.email || "").toLowerCase();
        break;
    }
    
    if (sortOrder === "asc") {
      if (typeof aValue === "string") return aValue.localeCompare(bValue);
      return aValue - bValue;
    } else {
      if (typeof aValue === "string") return bValue.localeCompare(aValue);
      return bValue - aValue;
    }
  });
  
  return users.slice(0, limitCount);
}

export async function searchHashtagsWithFilters(db, options = {}) {
  const {
    searchTerm = "",
    minCount = 0,
    sortBy = "count",
    sortOrder = "desc",
    limitCount = 20,
  } = options;
  
  const postsCol = collection(db, "posts");
  const q = query(postsCol, where("status", "==", "published"), limit(100));
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
  
  let hashtags = Array.from(hashtagCounts.entries())
    .map(([hashtag, count]) => ({ hashtag, count }));
  
  // Apply search term filter
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    hashtags = hashtags.filter(h => h.hashtag.includes(searchLower));
  }
  
  // Apply minimum count filter
  if (minCount > 0) {
    hashtags = hashtags.filter(h => h.count >= minCount);
  }
  
  // Apply sorting
  hashtags.sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case "hashtag":
        aValue = a.hashtag;
        bValue = b.hashtag;
        break;
      case "count":
      default:
        aValue = a.count;
        bValue = b.count;
        break;
    }
    
    if (sortOrder === "asc") {
      if (typeof aValue === "string") return aValue.localeCompare(bValue);
      return aValue - bValue;
    } else {
      if (typeof aValue === "string") return bValue.localeCompare(aValue);
      return bValue - aValue;
    }
  });
  
  return hashtags.slice(0, limitCount);
}

export function getAvailableSortOptions() {
  return [
    { value: "createdAt", label: "Date Created" },
    { value: "viewCount", label: "View Count" },
    { value: "reactionCount", label: "Reaction Count" },
    { value: "commentCount", label: "Comment Count" },
  ];
}

export function getAvailableUserSortOptions() {
  return [
    { value: "email", label: "Email" },
    { value: "displayName", label: "Display Name" },
    { value: "followerCount", label: "Follower Count" },
    { value: "followingCount", label: "Following Count" },
  ];
}

export function getAvailableHashtagSortOptions() {
  return [
    { value: "hashtag", label: "Hashtag" },
    { value: "count", label: "Count" },
  ];
}
