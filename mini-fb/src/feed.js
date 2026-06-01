import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { getFollowingUids } from "./follows.js";
import { canViewPost } from "./post-visibility.js";
import { renderPostCard, openCommentsForPost } from "./post-card.js";

const FEED_PAGE_SIZE = 25;
let unsubscribeFeed = null;
let displayLimit = FEED_PAGE_SIZE;
let currentFeedMode = "all";

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

export function startFeed(firebaseApp, { mode = "all", resetLimit = true } = {}) {
  window.__firebaseApp = firebaseApp;
  currentFeedMode = mode;
  if (resetLimit) displayLimit = FEED_PAGE_SIZE;

  const db = getDbService(firebaseApp);
  const feedEl = document.getElementById("feed");
  const feedEmptyEl = document.getElementById("feedEmpty");
  const feedCountEl = document.getElementById("feedCount");
  const loadMoreBtn = document.getElementById("loadMoreFeed");

  if (unsubscribeFeed) {
    unsubscribeFeed();
    unsubscribeFeed = null;
  }

  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(150));
  let followingSet = new Set();

  const refreshFollowing = async () => {
    const user = getCurrentUser();
    if (!user) {
      followingSet = new Set();
      return;
    }
    const uids = await getFollowingUids(db, user.uid);
    followingSet = new Set(uids);
    followingSet.add(user.uid);
  };

  unsubscribeFeed = onSnapshot(q, async (snapshot) => {
    await refreshFollowing();
    const viewerUid = getCurrentUser()?.uid;

    let posts = [];
    snapshot.forEach((docSnap) => posts.push({ id: docSnap.id, ...docSnap.data() }));

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
          ? "No posts from people you follow. Try All posts or follow users from Search."
          : "No posts yet. Create the first one above.";
      feedEmptyEl.classList.remove("hidden");
    }

    visible.forEach((post) => feedEl.appendChild(renderPostCard(post, db)));

    feedCountEl.textContent = `${visible.length}${total > visible.length ? ` of ${total}` : ""} post${total === 1 ? "" : "s"}`;

    if (loadMoreBtn) {
      loadMoreBtn.classList.toggle("hidden", total <= displayLimit);
      loadMoreBtn.onclick = () => {
        displayLimit += FEED_PAGE_SIZE;
        startFeed(firebaseApp, { mode: currentFeedMode, resetLimit: false });
      };
    }

    const params = new URLSearchParams(window.location.search);
    const highlightPost = params.get("post");
    scrollToHighlightedPost(highlightPost);
    if (highlightPost && (params.get("comments") === "1" || params.get("openComments") === "1")) {
      setTimeout(() => openCommentsForPost(highlightPost), 400);
    }
  });
}
