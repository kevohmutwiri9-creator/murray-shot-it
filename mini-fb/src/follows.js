// Follow system for SnapVerse
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, onSnapshot, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getCurrentUser } from "./auth.js";
import { createNotificationForFollow } from "./notifications.js";

export async function followUser(db, followerUid, followingUid, firebaseApp = null) {
  const followRef = doc(db, "followers", `${followerUid}_${followingUid}`);
  await setDoc(followRef, {
    followerUid,
    followingUid,
    createdAt: new Date()
  });
  if (firebaseApp) {
    const user = getCurrentUser();
    await createNotificationForFollow(firebaseApp, {
      toUid: followingUid,
      actorUid: followerUid,
      actorEmail: user?.email,
    });
  }
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

export async function getFollowerUids(db, followingUid) {
  const q = query(collection(db, "followers"), where("followingUid", "==", followingUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().followerUid).filter(Boolean);
}

// Close friends list functionality
export async function addToCloseFriends(db, uid, friendUid) {
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in to manage close friends.");
  if (user.uid !== uid) throw new Error("You can only manage your own close friends.");
  
  const closeFriendRef = doc(db, "closeFriends", `${uid}_${friendUid}`);
  await setDoc(closeFriendRef, {
    uid,
    friendUid,
    createdAt: serverTimestamp(),
  });
}

export async function removeFromCloseFriends(db, uid, friendUid) {
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in to manage close friends.");
  if (user.uid !== uid) throw new Error("You can only manage your own close friends.");
  
  const closeFriendRef = doc(db, "closeFriends", `${uid}_${friendUid}`);
  await deleteDoc(closeFriendRef);
}

export async function isCloseFriend(db, uid, friendUid) {
  const closeFriendRef = doc(db, "closeFriends", `${uid}_${friendUid}`);
  const snap = await getDoc(closeFriendRef);
  return snap.exists();
}

export async function getCloseFriendsUids(db, uid) {
  const q = query(collection(db, "closeFriends"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().friendUid).filter(Boolean);
}

export function subscribeToCloseFriends(db, uid, callback) {
  const q = query(collection(db, "closeFriends"), where("uid", "==", uid));
  return onSnapshot(q, (snapshot) => {
    const closeFriendUids = snapshot.docs.map((d) => d.data().friendUid).filter(Boolean);
    callback(closeFriendUids);
  });
}

export async function getCloseFriendsCount(db, uid) {
  const q = query(collection(db, "closeFriends"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.size;
}
