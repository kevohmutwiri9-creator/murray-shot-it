import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

function safeName(name) {
  return (name || "file")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 120);
}

export async function uploadFileToStorage(firebaseApp, { uid, file, folder = "uploads", onProgress } = {}) {
  if (!firebaseApp) throw new Error("Missing Firebase app.");
  if (!uid) throw new Error("Missing user id.");
  if (!file) throw new Error("No file provided.");

  const storage = getStorage(firebaseApp);
  const key = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName(file.name)}`;
  const path = `${folder}/${uid}/${key}`;
  const objectRef = ref(storage, path);

  const task = uploadBytesResumable(objectRef, file, { contentType: file.type || undefined });

  const url = await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (typeof onProgress === "function" && snap.totalBytes) {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          onProgress(pct);
        }
      },
      (err) => reject(err),
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });

  return { url, path };
}

