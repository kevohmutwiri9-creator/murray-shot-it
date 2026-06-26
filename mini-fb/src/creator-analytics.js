import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  sum,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";

// creator_analytics collection:
// - id: string (userId)
// - userId: string
// - totalFollowers: number
// - totalPosts: number
// - totalLikes: number
// - totalComments: number
// - totalShares: number
// - totalViews: number
// - engagementRate: number
// - topPosts: array of postIds
// - audienceDemographics: {
//   - ageGroups: { '18-24': number, '25-34': number, etc. }
//   - gender: { male: number, female: number, other: number }
//   - locations: { country: number }
// }
// - postingSchedule: { day: number, hour: number, engagement: number }
// - bestPostingTimes: array of { day, hour }
// - updatedAt: timestamp

// post_analytics collection:
// - id: string (postId)
// - postId: string
// - authorId: string
// - likes: number
// - comments: number
// - shares: number
// - views: number
// - reach: number
// - engagementRate: number
// - demographics: { ageGroups, gender, locations }
// - createdAt: timestamp
// - updatedAt: timestamp

/**
 * Get creator analytics for a user
 */
export async function getCreatorAnalytics(db, userId) {
  const analyticsRef = doc(db, "creator_analytics", userId);
  const snap = await getDoc(analyticsRef);
  
  if (!snap.exists()) {
    return {
      totalFollowers: 0,
      totalPosts: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalViews: 0,
      engagementRate: 0,
      topPosts: [],
      audienceDemographics: {
        ageGroups: {},
        gender: {},
        locations: {},
      },
      bestPostingTimes: [],
    };
  }
  
  return snap.data();
}

/**
 * Update post analytics
 */
export async function updatePostAnalytics(db, postId, authorId, metrics) {
  const postAnalyticsRef = doc(db, "post_analytics", postId);
  const snap = await getDoc(postAnalyticsRef);
  
  const updates = {
    ...metrics,
    updatedAt: serverTimestamp(),
  };
  
  if (snap.exists()) {
    await updateDoc(postAnalyticsRef, updates);
  } else {
    await setDoc(postAnalyticsRef, {
      postId,
      authorId,
      ...updates,
      createdAt: serverTimestamp(),
    });
  }
  
  // Update creator analytics
  await updateCreatorAnalytics(db, authorId, metrics);
}

/**
 * Update creator analytics
 */
export async function updateCreatorAnalytics(db, userId, metrics) {
  const analyticsRef = doc(db, "creator_analytics", userId);
  const snap = await getDoc(analyticsRef);
  
  const updates = {
    ...metrics,
    updatedAt: serverTimestamp(),
  };
  
  if (snap.exists()) {
    await updateDoc(analyticsRef, updates);
  } else {
    await setDoc(analyticsRef, {
      userId,
      ...updates,
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * Track post view
 */
export async function trackPostView(db, postId, authorId, viewerId, viewerData) {
  const postAnalyticsRef = doc(db, "post_analytics", postId);
  const snap = await getDoc(postAnalyticsRef);
  
  if (snap.exists()) {
    await updateDoc(postAnalyticsRef, {
      views: increment(1),
      updatedAt: serverTimestamp(),
    });
  }
  
  // Update demographics if viewer data is available
  if (viewerData) {
    await updateDemographics(db, postId, authorId, viewerData);
  }
}

/**
 * Update demographics data
 */
export async function updateDemographics(db, postId, authorId, viewerData) {
  const postAnalyticsRef = doc(db, "post_analytics", postId);
  
  const demographics = {};
  
  if (viewerData.age) {
    const ageGroup = getAgeGroup(viewerData.age);
    demographics[`audienceDemographics.ageGroups.${ageGroup}`] = increment(1);
  }
  
  if (viewerData.gender) {
    demographics[`audienceDemographics.gender.${viewerData.gender}`] = increment(1);
  }
  
  if (viewerData.location) {
    demographics[`audienceDemographics.locations.${viewerData.location}`] = increment(1);
  }
  
  if (Object.keys(demographics).length > 0) {
    await updateDoc(postAnalyticsRef, demographics);
  }
}

/**
 * Get age group from age
 */
function getAgeGroup(age) {
  if (age < 18) return 'under_18';
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55+';
}

/**
 * Calculate engagement rate
 */
export function calculateEngagementRate(likes, comments, shares, followers) {
  if (followers === 0) return 0;
  const totalEngagement = likes + comments + shares;
  return ((totalEngagement / followers) * 100).toFixed(2);
}

/**
 * Get top performing posts
 */
export async function getTopPosts(db, userId, limit = 5) {
  const postsRef = collection(db, "post_analytics");
  const q = query(
    postsRef,
    where("authorId", "==", userId),
    orderBy("engagementRate", "desc"),
    limit
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get analytics for a date range
 */
export async function getAnalyticsByDateRange(db, userId, startDate, endDate) {
  const postsRef = collection(db, "post_analytics");
  const q = query(
    postsRef,
    where("authorId", "==", userId),
    where("createdAt", ">=", startDate),
    where("createdAt", "<=", endDate)
  );
  
  const snapshot = await getDocs(q);
  const posts = snapshot.docs.map(doc => doc.data());
  
  return {
    totalPosts: posts.length,
    totalLikes: posts.reduce((sum, p) => sum + (p.likes || 0), 0),
    totalComments: posts.reduce((sum, p) => sum + (p.comments || 0), 0),
    totalShares: posts.reduce((sum, p) => sum + (p.shares || 0), 0),
    totalViews: posts.reduce((sum, p) => sum + (p.views || 0), 0),
  };
}

/**
 * Get audience insights
 */
export async function getAudienceInsights(db, userId) {
  const analytics = await getCreatorAnalytics(db, userId);
  return analytics.audienceDemographics || {
    ageGroups: {},
    gender: {},
    locations: {},
  };
}

/**
 * Get best posting times
 */
export async function getBestPostingTimes(db, userId) {
  const analytics = await getCreatorAnalytics(db, userId);
  return analytics.bestPostingTimes || [];
}

/**
 * Track posting schedule data
 */
export async function trackPostingSchedule(db, userId, day, hour, engagement) {
  const analyticsRef = doc(db, "creator_analytics", userId);
  const scheduleKey = `postingSchedule.${day}_${hour}`;
  
  await updateDoc(analyticsRef, {
    [scheduleKey]: increment(engagement),
    updatedAt: serverTimestamp(),
  });
}
