import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
  getDocs,
  startAfter,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { getFollowingUids } from "./follows.js";
import { canViewPost } from "./post-visibility.js";
import { renderPostCard, openCommentsForPost } from "./post-card.js";
import { getBlockedUids, filterBlockedPosts } from "./blocks.js";
import { showToast } from "./ui.js";

const FEED_PAGE_SIZE = 25;
const LIVE_WINDOW = 30;

let unsubscribeFeed = null;
let displayLimit = FEED_PAGE_SIZE;
let currentFeedMode = "all";
let livePosts = [];
let extraPosts = [];
let lastLiveDoc = null;
let lastExtraDoc = null;
let loadingMore = false;
let blockedSet = new Set();

function scrollToHighlightedPost(postId) {
  if (!postId) return;
  requestAnimationFrame(() => {
    const el = document.getElementById(`post-${postId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-4", "ring-accent/40");
      setTimeout(() => el.classList.remove("ring-4", "ring-accent/40"), 3000);
    }
  });
}

function mergePosts() {
  const seen = new Set();
  const merged = [];
  for (const p of [...livePosts, ...extraPosts]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }
  return merged;
}

async function renderFeed(firebaseApp, mode) {
  const db = getDbService(firebaseApp);
  const feedEl = document.getElementById("feed");
  const feedEmptyEl = document.getElementById("feedEmpty");
  const feedCountEl = document.getElementById("feedCount");
  const loadMoreBtn = document.getElementById("loadMoreFeed");
  const viewerUid = getCurrentUser()?.uid;

  let followingSet = new Set();
  const user = getCurrentUser();
  if (user) {
    const uids = await getFollowingUids(db, user.uid);
    followingSet = new Set(uids);
    followingSet.add(user.uid);
    blockedSet = await getBlockedUids(db, user.uid);
  }

  let posts = mergePosts();
  posts = filterBlockedPosts(posts, blockedSet);
  posts = posts.filter((p) => canViewPost(p, viewerUid, followingSet));
  if (mode === "following") {
    posts = posts.filter((p) => followingSet.has(p.authorUid));
  }

  const total = posts.length;
  const visible = posts.slice(0, displayLimit);

  feedEl.innerHTML = "";
  feedEmptyEl.classList.toggle("hidden", visible.length > 0);

  if (visible.length === 0) {
    feedEmptyEl.textContent =
      mode === "following"
        ? "No posts from people you follow. Try All posts or follow users from Explore."
        : "No posts yet. Create the first one above.";
    feedEmptyEl.classList.remove("hidden");
  }

  visible.forEach((post) => feedEl.appendChild(renderPostCard(post, db)));

  feedCountEl.textContent = `${visible.length}${total > visible.length ? ` of ${total}` : ""} post${total === 1 ? "" : "s"}`;

  if (loadMoreBtn) {
    const canLoadMore = total > displayLimit || lastExtraDoc || (livePosts.length >= LIVE_WINDOW && displayLimit >= livePosts.length);
    loadMoreBtn.classList.toggle("hidden", !canLoadMore && total <= displayLimit);
    loadMoreBtn.disabled = loadingMore;
    loadMoreBtn.textContent = loadingMore ? "Loading..." : "Load more posts";
  }

  const params = new URLSearchParams(window.location.search);
  const highlightPost = params.get("post");
  scrollToHighlightedPost(highlightPost);
  if (highlightPost && (params.get("comments") === "1" || params.get("openComments") === "1")) {
    setTimeout(() => openCommentsForPost(highlightPost), 400);
  }
}

export function startFeed(firebaseApp, { mode = "all", resetLimit = true } = {}) {
  window.__firebaseApp = firebaseApp;
  currentFeedMode = mode;
  if (resetLimit) {
    displayLimit = FEED_PAGE_SIZE;
    extraPosts = [];
    lastExtraDoc = null;
  }

  const db = getDbService(firebaseApp);
  const loadMoreBtn = document.getElementById("loadMoreFeed");

  if (unsubscribeFeed) {
    unsubscribeFeed();
    unsubscribeFeed = null;
  }

  const liveQ = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(LIVE_WINDOW));

  unsubscribeFeed = onSnapshot(liveQ, async (snapshot) => {
    livePosts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    lastLiveDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    await renderFeed(firebaseApp, mode);
  }, (error) => {
    console.error("Error loading feed:", error);
    showToast("Failed to load feed. Please refresh the page.", "error");
  });

  loadMoreBtn.onclick = async () => {
    if (loadingMore) return;
    const merged = mergePosts();
    if (displayLimit < merged.length) {
      displayLimit += FEED_PAGE_SIZE;
      await renderFeed(firebaseApp, mode);
      return;
    }

    loadingMore = true;
    loadMoreBtn.disabled = true;
    try {
      const cursor = lastExtraDoc || lastLiveDoc;
      if (!cursor) return;
      const q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        startAfter(cursor),
        limit(FEED_PAGE_SIZE)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        lastExtraDoc = null;
        return;
      }
      snap.forEach((d) => extraPosts.push({ id: d.id, ...d.data() }));
      lastExtraDoc = snap.docs[snap.docs.length - 1];
      displayLimit += FEED_PAGE_SIZE;
      await renderFeed(firebaseApp, mode);
    } catch (error) {
      console.error("Error loading more posts:", error);
      showToast("Failed to load more posts. Please try again.", "error");
    } finally {
      loadingMore = false;
      loadMoreBtn.disabled = false;
    }
  };
}
