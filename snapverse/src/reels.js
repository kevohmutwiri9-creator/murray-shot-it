import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { profileUrl } from "./profiles-cache.js";
import { isFollowing, followUser, unfollowUser } from "./follows.js";
import { showToast } from "./ui.js";

function authorLabel(item) {
  return item.authorEmail?.split("@")[0] || item.authorDisplayName || "User";
}

function createReelCard(item, { meUid, firebase, db } = {}) {
  const card = document.createElement("article");
  card.className =
    "reel-card rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden snap-start";
  card.id = `reel-${item.id}`;

  const video = document.createElement("video");
  video.src = item.mediaUrl;
  video.className = "w-full max-h-[80vh] bg-black object-contain";
  video.controls = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.loop = true;
  video.muted = true;
  video.dataset.reelVideo = "1";
  card.appendChild(video);

  const footer = document.createElement("div");
  footer.className = "p-3 space-y-1";
  const author = document.createElement("a");
  author.href = profileUrl(item.authorUid);
  author.className = "text-sm font-semibold hover:text-accent transition";
  author.textContent = authorLabel(item);
  const caption = document.createElement("p");
  caption.className = "text-sm text-gray-700 dark:text-gray-300";
  caption.textContent = item.text || item.title || "";
  const actions = document.createElement("div");
  actions.className = "flex gap-2 pt-1";
  actions.innerHTML = `
    <a href="/index.html?post=${encodeURIComponent(item.id)}&comments=1" class="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Comments</a>
    <a href="${profileUrl(item.authorUid)}" class="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Creator</a>
  `;

  if (meUid && item.authorUid && item.authorUid !== meUid && db) {
    const followBtn = document.createElement("button");
    followBtn.type = "button";
    followBtn.className =
      "text-xs px-2 py-1 rounded-lg bg-accent text-white hover:bg-accent/90";
    followBtn.textContent = "Follow";

    isFollowing(db, meUid, item.authorUid)
      .then((f) => {
        followBtn.textContent = f ? "Following" : "Follow";
        followBtn.className = f
          ? "text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          : "text-xs px-2 py-1 rounded-lg bg-accent text-white hover:bg-accent/90";
      })
      .catch(() => {});

    followBtn.addEventListener("click", async () => {
      try {
        const f = await isFollowing(db, meUid, item.authorUid);
        if (f) await unfollowUser(db, meUid, item.authorUid);
        else await followUser(db, meUid, item.authorUid, firebase);
        showToast(f ? "Unfollowed." : "Following!", f ? "info" : "success");
        const now = await isFollowing(db, meUid, item.authorUid);
        followBtn.textContent = now ? "Following" : "Follow";
        followBtn.className = now
          ? "text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          : "text-xs px-2 py-1 rounded-lg bg-accent text-white hover:bg-accent/90";
      } catch (err) {
        showToast(err.message || "Could not update follow.", "error");
      }
    });
    actions.appendChild(followBtn);
  }

  footer.append(author, caption, actions);
  card.appendChild(footer);
  return card;
}

function setupAutoplay(containerEl) {
  const videos = [...containerEl.querySelectorAll("video[data-reel-video='1']")];
  if (!videos.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const v = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      });
    },
    { threshold: [0.1, 0.7, 0.95] }
  );
  videos.forEach((v) => observer.observe(v));
}

export function startReelsPage(db, containerEl, opts = {}) {
  const q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(100)
  );
  return onSnapshot(q, (snapshot) => {
    const reels = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => (p.type === "reel" || p.mediaType === "video") && p.mediaUrl);

    containerEl.innerHTML = "";
    if (!reels.length) {
      containerEl.innerHTML =
        '<p class="text-sm text-gray-500 text-center py-10">No reels yet. Post short videos to see them here.</p>';
      return;
    }

    reels.forEach((item) => containerEl.appendChild(createReelCard(item, { ...opts, db })));
    setupAutoplay(containerEl);

    const targetId = decodeURIComponent(location.hash || "").replace(/^#/, "");
    if (targetId) {
      const target = document.getElementById(`reel-${targetId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

export function startReelsPreview(db, containerEl) {
  const q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(30)
  );
  return onSnapshot(q, (snapshot) => {
    const reels = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => (p.type === "reel" || p.mediaType === "video") && p.mediaUrl)
      .slice(0, 8);

    containerEl.innerHTML = "";
    if (!reels.length) {
      containerEl.innerHTML =
        '<p class="text-sm text-gray-500">No reels yet.</p>';
      return;
    }

    reels.forEach((item) => {
      const a = document.createElement("a");
      a.href = `/snapverse/reels.html#${item.id}`;
      a.className =
        "relative block h-44 w-28 shrink-0 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700";
      a.innerHTML = `
        <video src="${item.mediaUrl}" class="h-full w-full object-cover bg-black" muted playsinline preload="metadata"></video>
        <span class="absolute bottom-1 left-1 right-1 text-[11px] text-white font-semibold truncate bg-black/30 px-1.5 py-0.5 rounded">${authorLabel(item)}</span>
      `;
      containerEl.appendChild(a);
    });
  });
}

