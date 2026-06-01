// Follow system for SnapVerse
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function followUser(db, followerUid, followingUid) {
  const followRef = doc(db, "followers", `${followerUid}_${followingUid}`);
  await setDoc(followRef, {
    followerUid,
    followingUid,
    createdAt: new Date()
  });
}

export async function unfollowUser(db, followerUid, followingUid) {
  const followRef = doc(db, "followers", `${followerUid}_${followingUid}`);
  await deleteDoc(followRef);
}

export async function isFollowing(db, followerUid, followingUid) {
  const followRef = doc(db, "followers", `${followerUid}_${followingUid}`);
  const snap = await getDoc(followRef);
  return snap.exists();
}

export function getFollowersCount(db, uid) {
  const followersCol = collection(db, "followers");
  const q = query(followersCol, where("followingUid", "==", uid));
  return new Promise((resolve) => {
    onSnapshot(q, (snapshot) => {
      resolve(snapshot.size);
    });
  });
}

export function getFollowingCount(db, uid) {
  const followingCol = collection(db, "followers");
  const q = query(followingCol, where("followerUid", "==", uid));
  return new Promise((resolve) => {
    onSnapshot(q, (snapshot) => {
      resolve(snapshot.size);
    });
  });
}

export async function getFollowingUids(db, followerUid) {
  const q = query(collection(db, "followers"), where("followerUid", "==", followerUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().followingUid).filter(Boolean);
}
