import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { profileUrl } from "./profiles-cache.js";

function authorLabel(item) {
  return item.authorEmail?.split("@")[0] || item.authorDisplayName || "User";
}

function createReelCard(item) {
  const card = document.createElement("article");
  card.className =
    "rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden";

  const video = document.createElement("video");
  video.src = item.mediaUrl;
  video.className = "w-full max-h-[80vh] bg-black object-contain";
  video.controls = true;
  video.playsInline = true;
  video.preload = "metadata";
  card.appendChild(video);

  const footer = document.createElement("div");
  footer.className = "p-3 space-y-1";
  footer.innerHTML = `
    <a href="${profileUrl(item.authorUid)}" class="text-sm font-semibold hover:text-accent transition">${authorLabel(item)}</a>
    <p class="text-sm text-gray-700 dark:text-gray-300">${item.text || item.title || ""}</p>
  `;
  card.appendChild(footer);
  return card;
}

export function startReelsPage(db, containerEl) {
  const q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(100)
  );
  return onSnapshot(q, (snapshot) => {
    const reels = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => p.mediaType === "video" && p.mediaUrl);

    containerEl.innerHTML = "";
    if (!reels.length) {
      containerEl.innerHTML =
        '<p class="text-sm text-gray-500 text-center py-10">No reels yet. Post short videos to see them here.</p>';
      return;
    }

    reels.forEach((item) => containerEl.appendChild(createReelCard(item)));
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
      .filter((p) => p.mediaType === "video" && p.mediaUrl)
      .slice(0, 8);

    containerEl.innerHTML = "";
    if (!reels.length) {
      containerEl.innerHTML =
        '<p class="text-sm text-gray-500">No reels yet.</p>';
      return;
    }

    reels.forEach((item) => {
      const a = document.createElement("a");
      a.href = `/mini-fb/reels.html#${item.id}`;
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
