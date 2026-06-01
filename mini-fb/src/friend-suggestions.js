import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFollowingUids } from "./follows.js";

export async function getFriendSuggestions(db, uid, limit = 8) {
  const myFollowing = await getFollowingUids(db, uid);
  const exclude = new Set([uid, ...myFollowing]);
  const scores = new Map();

  const sample = myFollowing.slice(0, 25);
  await Promise.all(
    sample.map(async (fid) => {
      const theirs = await getFollowingUids(db, fid);
      theirs.forEach((c) => {
        if (exclude.has(c)) return;
        scores.set(c, (scores.get(c) || 0) + 1);
      });
    })
  );

  if (scores.size < limit) {
    const profilesSnap = await getDocs(collection(db, "profiles"));
    profilesSnap.forEach((d) => {
      if (!exclude.has(d.id) && !scores.has(d.id)) scores.set(d.id, 0);
    });
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const profilesSnap = await getDocs(collection(db, "profiles"));
  const profileMap = new Map();
  profilesSnap.forEach((d) => profileMap.set(d.id, { uid: d.id, ...d.data() }));

  return ranked.map(([uidKey, mutualCount]) => ({
    ...(profileMap.get(uidKey) || { uid: uidKey }),
    uid: uidKey,
    mutualCount,
  }));
}
