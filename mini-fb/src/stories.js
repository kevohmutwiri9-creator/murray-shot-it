import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { uploadMedia } from "./image-upload.js";
import { openStoryViewer, showToast } from "./ui.js";
import { getCurrentUser } from "./auth.js";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

function parseExpiresAt(story) {
  if (story.expiresAt?.toDate) return story.expiresAt.toDate();
  return new Date(story.expiresAt);
}

export function startStories(db, { containerEl, addBtnEl, firebaseApp }) {
  const storiesCol = collection(db, "stories");
  const q = query(storiesCol, orderBy("createdAt", "desc"));

  onSnapshot(q, async (snapshot) => {
    const now = new Date();
    containerEl.innerHTML = "";
    const stories = [];

    for (const docSnap of snapshot.docs) {
      const story = { id: docSnap.id, ...docSnap.data() };
      const expiresAt = parseExpiresAt(story);
      if (expiresAt <= now) {
        deleteDoc(doc(db, "stories", docSnap.id)).catch(() => {});
        continue;
      }
      stories.push(story);
    }

    if (stories.length === 0) {
      containerEl.innerHTML =
        '<span class="text-gray-500 dark:text-gray-400 text-sm">No stories yet — add one!</span>';
      return;
    }

    stories.forEach((story) => {
      const storyEl = document.createElement("button");
      storyEl.type = "button";
      storyEl.className =
        "flex-shrink-0 w-20 h-20 rounded-xl bg-gradient-to-br from-accent to-purple-600 cursor-pointer relative overflow-hidden ring-2 ring-accent/50 hover:ring-accent transition focus:outline-none focus:ring-4";
      storyEl.setAttribute("aria-label", `View story by ${story.authorEmail || "user"}`);

      if (story.mediaUrl) {
        const img = document.createElement("img");
        img.src = story.mediaUrl;
        img.alt = "";
        img.className = "w-full h-full object-cover";
        storyEl.appendChild(img);
      }

      const overlay = document.createElement("div");
      overlay.className = "absolute inset-0 bg-black/30 pointer-events-none";
      storyEl.appendChild(overlay);

      const label = document.createElement("div");
      label.className =
        "absolute bottom-1 left-1 right-1 text-white text-xs font-semibold truncate pointer-events-none";
      label.textContent = story.authorEmail?.split("@")[0] || "User";
      storyEl.appendChild(label);

      storyEl.addEventListener("click", () => openStoryViewer(story));
      containerEl.appendChild(storyEl);
    });
  });

  addBtnEl?.addEventListener("click", () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,video/*";
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const user = getCurrentUser();
      if (!user) {
        showToast("Sign in to add a story.", "error");
        return;
      }

      try {
        showToast("Uploading story...", "info");
        const result = await uploadMedia(file);
        const expiresAt = Timestamp.fromMillis(Date.now() + STORY_TTL_MS);

        await addDoc(collection(db, "stories"), {
          mediaUrl: result.url,
          mediaType: result.mediaType,
          authorUid: user.uid,
          authorEmail: user.email || null,
          createdAt: serverTimestamp(),
          expiresAt,
        });

        showToast("Story added!", "success");
      } catch (error) {
        showToast(error.message || "Failed to add story.", "error");
      }
    };
    fileInput.click();
  });
}
