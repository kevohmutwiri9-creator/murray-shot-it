import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { requireAuth, hideAdminNavIfNeeded, bootPage } from "./page-boot.js";
import { startFeed } from "./feed.js";
import { bindCreatePost } from "./admin.js";
import { publishDueScheduledPosts } from "./scheduled-posts.js";
import { startStories } from "./stories.js";
import { startNotifications } from "./notifications.js";
import { bindCharCounter, bindMediaPreview, closeModal, showToast } from "./ui.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function bootFeedPage(firebase) {
  const user = await requireAuth(firebase);
  if (!user) return;

  document.getElementById("auth-loading")?.classList.add("hidden");

  await hideAdminNavIfNeeded(firebase, user);
  bootPage(firebase);

  window.currentFirebaseUser = user;
  window.__firebaseApp = firebase;

  const db = getDbService(firebase);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/mini-fb/sw.js").catch(() => {});
  }

  // Publish due scheduled posts on load + interval
  const runScheduler = async () => {
    try {
      const n = await publishDueScheduledPosts(db);
      if (n > 0) showToast(`${n} scheduled post(s) published.`, "success");
    } catch {
      /* rules or offline */
    }
  };
  await runScheduler();
  setInterval(runScheduler, 60_000);

  // Feed filter: all | following
  const feedFilterAll = document.getElementById("feedFilterAll");
  const feedFilterFollowing = document.getElementById("feedFilterFollowing");
  let feedMode = localStorage.getItem("feedMode") || "all";

  const styleFilterBtn = (btn, active) => {
    if (!btn) return;
    btn.className = active
      ? "px-3 py-1.5 text-sm font-semibold rounded-lg bg-accent text-white transition"
      : "px-3 py-1.5 text-sm font-semibold rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition";
  };

  const setFeedMode = (mode) => {
    feedMode = mode;
    localStorage.setItem("feedMode", mode);
    styleFilterBtn(feedFilterAll, mode === "all");
    styleFilterBtn(feedFilterFollowing, mode === "following");
    startFeed(firebase, { mode: feedMode, resetLimit: true });
  };

  feedFilterAll?.addEventListener("click", () => setFeedMode("all"));
  feedFilterFollowing?.addEventListener("click", () => setFeedMode("following"));
  setFeedMode(feedMode);

  bindCreatePost(firebase, {
    titleEl: document.getElementById("postTitle"),
    textEl: document.getElementById("postText"),
    fileEl: document.getElementById("postFile"),
    scheduleEl: document.getElementById("postSchedule"),
    formEl: document.getElementById("createPostForm"),
    btnEl: document.getElementById("createPostBtn"),
    statusEl: document.getElementById("createPostStatus"),
  });

  bindCharCounter(document.getElementById("postTitle"), document.getElementById("postTitleCount"), 80);
  bindCharCounter(document.getElementById("postText"), document.getElementById("postTextCount"), 140);
  bindMediaPreview(document.getElementById("postFile"), document.getElementById("postMediaPreview"));

  startNotifications(firebase, {
    listEl: document.getElementById("notificationsList"),
    badgeEl: document.getElementById("notificationBadge"),
    panelEl: document.getElementById("notificationsPanel"),
    btnEl: document.getElementById("notificationsBtn"),
  });

  startStories(db, {
    containerEl: document.getElementById("storiesContainer"),
    addBtnEl: document.getElementById("addStoryBtn"),
  });

  loadTrendingTopics(db);

  // Edit post modal
  const editPostModal = document.getElementById("editPostModal");
  const editPostForm = document.getElementById("editPostForm");
  document.getElementById("cancelEditBtn")?.addEventListener("click", () => closeModal("editPostModal"));

  document.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-id]");
    if (!editBtn) return;
    document.getElementById("editPostId").value = editBtn.dataset.editId;
    document.getElementById("editPostTitle").value = editBtn.dataset.editTitle;
    document.getElementById("editPostText").value = editBtn.dataset.editText;
    editPostModal?.classList.remove("hidden");
  });

  editPostForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const postId = document.getElementById("editPostId").value;
    const title = document.getElementById("editPostTitle").value.trim();
    const text = document.getElementById("editPostText").value.trim();

    try {
      await updateDoc(doc(db, "posts", postId), { title, text, updatedAt: new Date() });
      closeModal("editPostModal");
      showToast("Post updated.", "success");
    } catch (err) {
      showToast(err.message || "Update failed.", "error");
    }
  });
}

async function loadTrendingTopics(db) {
  const container = document.getElementById("trendingTopics");
  if (!container) return;

  try {
    const hashtagsCol = collection(db, "hashtags");
    const snapshot = await getDocs(hashtagsCol);
    const trending = [];
    snapshot.forEach((docSnap) => trending.push({ id: docSnap.id, ...docSnap.data() }));
    trending.sort((a, b) => (b.count || 0) - (a.count || 0));
    const topTrending = trending.slice(0, 10);

    container.innerHTML = "";
    if (topTrending.length === 0) {
      container.innerHTML =
        '<span class="text-gray-500 dark:text-gray-400 text-sm">No trending topics yet</span>';
    } else {
      topTrending.forEach((hashtag) => {
        const tag = document.createElement("a");
        tag.href = `mini-fb/hashtag.html?tag=${encodeURIComponent(hashtag.id)}`;
        tag.className =
          "inline-flex items-center px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition";
        tag.textContent = `#${hashtag.id}`;
        container.appendChild(tag);
      });
    }
  } catch {
    container.innerHTML =
      '<span class="text-gray-500 dark:text-gray-400 text-sm">Trending unavailable</span>';
  }
}
