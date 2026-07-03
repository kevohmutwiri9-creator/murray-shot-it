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
  updateDoc,
  increment,
  getDoc,
  getDocs,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { uploadMedia } from "./image-upload.js";
import { openStoryViewer, showToast } from "./ui.js";
import { getCurrentUser } from "./auth.js";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const STORY_VIEWED_KEY = "sv_viewed_stories";

function parseExpiresAt(story) {
  if (story.expiresAt?.toDate) return story.expiresAt.toDate();
  return new Date(story.expiresAt);
}

export async function addStoryFromFile(db, file) {
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in to add a story.");

  const firebaseApp = window.__firebaseApp;
  const result = await uploadMedia(file, { firebaseApp, uid: user.uid });
  const expiresAt = Timestamp.fromMillis(Date.now() + STORY_TTL_MS);

  await addDoc(collection(db, "stories"), {
    mediaUrl: result.url,
    mediaType: result.mediaType,
    authorUid: user.uid,
    authorEmail: user.email || null,
    createdAt: serverTimestamp(),
    expiresAt,
    viewCount: 0,
  });
}

async function recordStoryView(db, storyId) {
  const user = getCurrentUser();
  if (!user) return;

  const storyRef = doc(db, "stories", storyId);
  const storySnap = await getDoc(storyRef);
  if (!storySnap.exists()) return;

  const story = storySnap.data();
  if (story.authorUid === user.uid) return; // Don't count own views

  await updateDoc(storyRef, {
    viewCount: increment(1),
  });
}

export function startStories(db, { containerEl, addBtnEl }) {
  if (!containerEl) return;

  const storiesCol = collection(db, "stories");
  const q = query(storiesCol, orderBy("createdAt", "desc"));

  onSnapshot(q, async (snapshot) => {
    let stories = [];

    try {
      const now = new Date();
      containerEl.innerHTML = "";
      stories = [];

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
    } catch (err) {
      console.error('Failed to load stories:', err);
      containerEl.innerHTML =
        '<span class="text-red-500 dark:text-red-400 text-sm">Stories unavailable right now.</span>';
      return;
    }

    const viewed = new Set(
      (() => {
        try {
          return JSON.parse(localStorage.getItem(STORY_VIEWED_KEY) || "[]");
        } catch {
          return [];
        }
      })()
    );

    stories.forEach((story) => {
      const storyEl = document.createElement("button");
      storyEl.type = "button";
      storyEl.className =
        `flex-shrink-0 w-20 h-20 rounded-xl bg-gradient-to-br from-accent to-purple-600 cursor-pointer relative overflow-hidden ring-2 ${viewed.has(story.id) ? "ring-gray-400/40" : "ring-accent/60"} hover:ring-accent transition focus:outline-none focus:ring-4`;
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

      // Add view count badge
      const viewBadge = document.createElement("div");
      viewBadge.className = "absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 pointer-events-none";
      viewBadge.innerHTML = `
        <svg class="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        </svg>
        <span>${story.viewCount || 0}</span>
      `;
      storyEl.appendChild(viewBadge);

      storyEl.addEventListener("click", async () => {
        openStoryViewer(story);
        viewed.add(story.id);
        localStorage.setItem(STORY_VIEWED_KEY, JSON.stringify([...viewed].slice(-300)));
        storyEl.classList.remove("ring-accent/60");
        storyEl.classList.add("ring-gray-400/40");
        
        // Record the view
        await recordStoryView(db, story.id);
      });
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
      try {
        showToast("Uploading story...", "info");
        await addStoryFromFile(db, file);
        showToast("Story added!", "success");
      } catch (error) {
        showToast(error.message || "Failed to add story.", "error");
      }
    };
    fileInput.click();
  });
}

// Story highlights functionality
export async function createStoryHighlight(db, name, storyIds, coverUrl = null) {
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in to create story highlights.");
  
  const highlightRef = doc(collection(db, "storyHighlights"));
  await setDoc(highlightRef, {
    id: highlightRef.id,
    name,
    authorUid: user.uid,
    storyIds,
    coverUrl,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return highlightRef.id;
}

export async function addStoryToHighlight(db, highlightId, storyId) {
  const highlightRef = doc(db, "storyHighlights", highlightId);
  const highlightSnap = await getDoc(highlightRef);
  
  if (!highlightSnap.exists()) {
    throw new Error("Highlight not found");
  }
  
  const highlightData = highlightSnap.data();
  const storyIds = highlightData.storyIds || [];
  
  if (!storyIds.includes(storyId)) {
    await updateDoc(highlightRef, {
      storyIds: [...storyIds, storyId],
      updatedAt: serverTimestamp(),
    });
  }
}

export async function removeStoryFromHighlight(db, highlightId, storyId) {
  const highlightRef = doc(db, "storyHighlights", highlightId);
  const highlightSnap = await getDoc(highlightRef);
  
  if (!highlightSnap.exists()) {
    throw new Error("Highlight not found");
  }
  
  const highlightData = highlightSnap.data();
  const storyIds = (highlightData.storyIds || []).filter(id => id !== storyId);
  
  await updateDoc(highlightRef, {
    storyIds,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteStoryHighlight(db, highlightId) {
  await deleteDoc(doc(db, "storyHighlights", highlightId));
}

export async function updateStoryHighlightCover(db, highlightId, coverUrl) {
  await updateDoc(doc(db, "storyHighlights", highlightId), {
    coverUrl,
    updatedAt: serverTimestamp(),
  });
}

export async function getUserStoryHighlights(db, uid) {
  const highlightsRef = collection(db, "storyHighlights");
  const q = query(highlightsRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(highlight => highlight.authorUid === uid);
}

export function subscribeToUserStoryHighlights(db, uid, callback) {
  const highlightsRef = collection(db, "storyHighlights");
  const q = query(highlightsRef, orderBy("createdAt", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    const highlights = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(highlight => highlight.authorUid === uid);
    callback(highlights);
  });
}

export async function getHighlightStories(db, highlightId) {
  const highlightRef = doc(db, "storyHighlights", highlightId);
  const highlightSnap = await getDoc(highlightRef);
  
  if (!highlightSnap.exists()) {
    return [];
  }
  
  const highlightData = highlightSnap.data();
  const storyIds = highlightData.storyIds || [];
  
  if (storyIds.length === 0) {
    return [];
  }
  
  const stories = [];
  for (const storyId of storyIds) {
    const storyRef = doc(db, "stories", storyId);
    const storySnap = await getDoc(storyRef);
    if (storySnap.exists()) {
      stories.push({ id: storyId, ...storySnap.data() });
    }
  }
  
  return stories;
}

export function renderStoryHighlights(highlights, container, onHighlightClick) {
  container.innerHTML = "";
  
  if (highlights.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No highlights yet.</p>';
    return;
  }
  
  highlights.forEach(highlight => {
    const highlightEl = document.createElement("div");
    highlightEl.className = "flex flex-col items-center gap-1 cursor-pointer group";
    highlightEl.onclick = () => onHighlightClick(highlight);
    
    const coverEl = document.createElement("div");
    coverEl.className = "w-16 h-16 rounded-full border-2 border-accent overflow-hidden bg-gray-200 dark:bg-gray-700 group-hover:scale-105 transition";
    
    if (highlight.coverUrl) {
      coverEl.innerHTML = `<img src="${highlight.coverUrl}" alt="${highlight.name}" class="w-full h-full object-cover">`;
    } else {
      coverEl.innerHTML = `<div class="w-full h-full flex items-center justify-center text-2xl">📸</div>`;
    }
    
    const nameEl = document.createElement("span");
    nameEl.className = "text-xs text-gray-700 dark:text-gray-300 truncate w-16 text-center";
    nameEl.textContent = highlight.name;
    
    highlightEl.appendChild(coverEl);
    highlightEl.appendChild(nameEl);
    container.appendChild(highlightEl);
  });
}
