import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";

function saveId(uid, postId) {
  return `${uid}_${postId}`;
}

export async function toggleSave(firebaseApp, postId) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const ref = doc(db, "saves", saveId(user.uid, postId));
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
    return { saved: false };
  }
  await setDoc(ref, { uid: user.uid, postId, createdAt: new Date() });
  return { saved: true };
}

export async function isPostSaved(firebaseApp, postId) {
  const user = getCurrentUser();
  if (!user) return false;
  const db = getDbService(firebaseApp);
  const snap = await getDoc(doc(db, "saves", saveId(user.uid, postId)));
  return snap.exists();
}

export async function getSavedPostIds(firebaseApp) {
  const user = getCurrentUser();
  if (!user) return [];
  const db = getDbService(firebaseApp);
  const q = query(collection(db, "saves"), where("uid", "==", user.uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().postId).filter(Boolean);
}

// Post bookmarking/saving improvements
export async function savePostWithNote(firebaseApp, postId, note = null, collectionId = null) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const ref = doc(db, "saves", saveId(user.uid, postId));
  const snap = await getDoc(ref);
  
  if (snap.exists()) {
    await updateDoc(ref, {
      note,
      collectionId,
      updatedAt: serverTimestamp(),
    });
    return { saved: true, updated: true };
  }
  
  await setDoc(ref, {
    uid: user.uid,
    postId,
    note,
    collectionId,
    createdAt: serverTimestamp(),
  });
  return { saved: true, updated: false };
}

export async function createBookmarkCollection(firebaseApp, name, emoji = "📁") {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const collectionRef = doc(collection(db, "bookmarkCollections"));
  await setDoc(collectionRef, {
    id: collectionRef.id,
    uid: user.uid,
    name,
    emoji,
    createdAt: serverTimestamp(),
  });
  
  return collectionRef.id;
}

export async function deleteBookmarkCollection(firebaseApp, collectionId) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const collectionRef = doc(db, "bookmarkCollections", collectionId);
  const snap = await getDoc(collectionRef);
  
  if (!snap.exists()) {
    throw new Error("Collection not found");
  }
  
  if (snap.data().uid !== user.uid) {
    throw new Error("You can only delete your own collections");
  }
  
  await deleteDoc(collectionRef);
}

export async function getBookmarkCollections(firebaseApp) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) return [];

  const q = query(collection(db, "bookmarkCollections"), where("uid", "==", user.uid));
  const snap = await getDocs(q);
  
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSavedPostsByCollection(firebaseApp, collectionId) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) return [];

  const q = query(
    collection(db, "saves"),
    where("uid", "==", user.uid),
    where("collectionId", "==", collectionId)
  );
  const snap = await getDocs(q);
  
  return snap.docs.map((d) => d.data().postId).filter(Boolean);
}

export async function updateBookmarkNote(firebaseApp, postId, note) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const ref = doc(db, "saves", saveId(user.uid, postId));
  const snap = await getDoc(ref);
  
  if (!snap.exists()) {
    throw new Error("Post not saved");
  }
  
  await updateDoc(ref, {
    note,
    updatedAt: serverTimestamp(),
  });
}

export async function movePostToCollection(firebaseApp, postId, collectionId) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const ref = doc(db, "saves", saveId(user.uid, postId));
  const snap = await getDoc(ref);
  
  if (!snap.exists()) {
    throw new Error("Post not saved");
  }
  
  await updateDoc(ref, {
    collectionId,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToSavedPosts(firebaseApp, callback) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) return () => {};

  const q = query(collection(db, "saves"), where("uid", "==", user.uid));
  
  return onSnapshot(q, (snapshot) => {
    const savedPosts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(savedPosts);
  });
}

export function subscribeToBookmarkCollections(firebaseApp, callback) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) return () => {};

  const q = query(collection(db, "bookmarkCollections"), where("uid", "==", user.uid));
  
  return onSnapshot(q, (snapshot) => {
    const collections = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(collections);
  });
}

export async function getSavedPostCount(firebaseApp) {
  const db = getDbService(firebaseApp);
  const user = getCurrentUser();
  if (!user) return 0;

  const q = query(collection(db, "saves"), where("uid", "==", user.uid));
  const snap = await getDocs(q);
  return snap.size;
}
