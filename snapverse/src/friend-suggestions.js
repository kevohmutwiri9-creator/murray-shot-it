import { collection, getDocs, query, where, orderBy, limit as limitClause } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFollowingUids, isFollowing } from "./follows.js";

export async function getFriendSuggestions(db, uid, limit = 8) {
  const myFollowing = await getFollowingUids(db, uid);
  const exclude = new Set([uid, ...myFollowing]);
  const scores = new Map();

  // Score based on mutual connections
  const sample = myFollowing.slice(0, 25);
  await Promise.all(
    sample.map(async (fid) => {
      const theirs = await getFollowingUids(db, fid);
      theirs.forEach((c) => {
        if (exclude.has(c)) return;
        scores.set(c, (scores.get(c) || 0) + 2); // Mutual connections worth 2 points
      });
    })
  );

  // Score based on recent activity (users with posts)
  try {
    const postsSnap = await getDocs(
      query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        limitClause(50)
      )
    );
    const recentPosters = new Set();
    postsSnap.forEach((d) => {
      const authorUid = d.data().authorUid;
      if (authorUid && !exclude.has(authorUid)) {
        recentPosters.add(authorUid);
        scores.set(authorUid, (scores.get(authorUid) || 0) + 1); // Recent activity worth 1 point
      }
    });
  } catch (err) {
    // Ignore errors if posts collection doesn't exist
  }

  // If still not enough suggestions, add random profiles
  if (scores.size < limit) {
    try {
      const profilesSnap = await getDocs(
        query(
          collection(db, "profiles"),
          limitClause(50)
        )
      );
      profilesSnap.forEach((d) => {
        if (!exclude.has(d.id) && !scores.has(d.id)) {
          scores.set(d.id, 0); // Random suggestions worth 0 points
        }
      });
    } catch (err) {
      // Ignore errors
    }
  }

  // Rank by score and get top suggestions
  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 2); // Get more than needed to filter further

  // Get profile data for ranked users
  const profileMap = new Map();
  try {
    const profilesSnap = await getDocs(collection(db, "profiles"));
    profilesSnap.forEach((d) => profileMap.set(d.id, { uid: d.id, ...d.data() }));
  } catch (err) {
    // Ignore errors
  }

  // Build suggestions with additional metadata
  const suggestions = [];
  for (const [uidKey, mutualCount] of ranked) {
    const profile = profileMap.get(uidKey);
    if (!profile) continue;
    
    // Calculate additional metrics
    const hasAvatar = !!profile.avatarUrl || !!profile.photoUrl;
    const hasBio = !!profile.bio;
    const completenessScore = (hasAvatar ? 1 : 0) + (hasBio ? 1 : 0);
    
    suggestions.push({
      ...profile,
      uid: uidKey,
      mutualCount,
      completenessScore,
      hasAvatar,
      hasBio,
    });
  }

  // Sort by combined score (mutual connections + profile completeness)
  suggestions.sort((a, b) => {
    const scoreA = a.mutualCount + a.completenessScore;
    const scoreB = b.mutualCount + b.completenessScore;
    return scoreB - scoreA;
  });

  return suggestions.slice(0, limit);
}
