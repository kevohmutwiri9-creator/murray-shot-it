import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { toggleShare } from "./shares.js";
import { formatTextWithHashtags } from "./hashtags.js";
import { formatTextWithMentions } from "./mentions.js";
import { getCurrentUser } from "./auth.js";
import { setReaction, getMyReaction, reactionEmoji } from "./reactions.js";
import { toggleSave, isPostSaved } from "./bookmarks.js";
import { repostToFeed } from "./repost.js";
import { mountCommentsPanel } from "./comments-panel.js";
import { isFollowing, followUser, unfollowUser } from "./follows.js";
import { profileUrl } from "./profiles-cache.js";
import { promptFlagReason, showToast, showReactionPicker, promptTextInput } from "./ui.js";

const cardCommentsUnsubs = new Map();

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function formatCreatedAt(createdAt) {
  if (createdAt?.toDate) {
    return createdAt.toDate().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  return "Just now";
}

function getAuthorLabel(post) {
  return post?.authorEmail?.split("@")[0] || post?.authorDisplayName || "User";
}

async function flagPost(postId) {
  const user = getCurrentUser();
  if (!user) return showToast("Sign in to flag posts.", "error");
  const reason = await promptFlagReason();
  if (!reason) return;
  const db = window.__firebaseApp.__db;
  await addDoc(collection(db, "flags"), {
    postId,
    reason,
    reporterUid: user.uid,
    reporterEmail: user.email || null,
    createdAt: serverTimestamp(),
    status: "pending",
  });
  showToast("Post flagged for review.", "success");
}

function buildMediaNode(post) {
  if (!post?.mediaUrl) return null;
  const wrap = createEl("div", "overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900");
  if (post.mediaType === "video") {
    const video = document.createElement("video");
    video.className = "w-full max-h-[520px] bg-black object-contain";
    video.controls = true;
    video.playsInline = true;
    video.src = post.mediaUrl;
    wrap.appendChild(video);
    return wrap;
  }
  const img = document.createElement("img");
  img.className = "w-full max-h-[520px] object-cover";
  img.alt = post.title || "Post media";
  img.loading = "lazy";
  img.src = post.mediaUrl;
  wrap.appendChild(img);
  return wrap;
}

function updateCountsOnCard(card, post) {
  card.querySelector(".likeCount").textContent = String(post.likeCount ?? 0);
  card.querySelector(".commentCount").textContent = String(post.commentCount ?? 0);
  card.querySelector(".shareCount").textContent = String(post.shareCount ?? 0);
}

export function openCommentsForPost(postId) {
  const card = document.getElementById(`post-${postId}`);
  if (!card) return;
  const panel = card.querySelector(".commentsPanel");
  if (!panel || !panel.classList.contains("hidden")) return;
  card.querySelector(".commentToggleBtn")?.click();
}

function showCommentsPanel(card, post, commentsPanel, statusEl) {
  if (!commentsPanel.classList.contains("hidden")) return;
  commentsPanel.classList.remove("hidden");
  if (!cardCommentsUnsubs.has(post.id)) {
    const unsub = mountCommentsPanel(window.__firebaseApp, post, commentsPanel, statusEl);
    cardCommentsUnsubs.set(post.id, unsub);
  }
}

function hideCommentsPanel(postId, commentsPanel) {
  commentsPanel.classList.add("hidden");
}

export function renderPostCard(post, db) {
  const card = createEl(
    "article",
    "overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-[0_18px_40px_rgba(15,23,42,0.08)] scroll-mt-24"
  );
  card.id = `post-${post.id}`;
  card.dataset.postId = post.id;
  const me = window.currentFirebaseUser;

  const header = createEl("div", "border-b border-gray-100 dark:border-gray-700 px-5 py-5 space-y-3");

  const authorRow = createEl("div", "flex items-center justify-between gap-3");
  const authorLink = createEl("a", "flex min-w-0 items-center gap-3 hover:opacity-80 transition");
  authorLink.href = profileUrl(post.authorUid);
  authorLink.append(
    createEl(
      "div",
      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white",
      (getAuthorLabel(post).charAt(0) || "S").toUpperCase()
    )
  );
  const authorMeta = createEl("div", "min-w-0");
  authorMeta.append(
    createEl("p", "text-sm font-bold text-gray-900 dark:text-white", getAuthorLabel(post)),
    createEl("p", "text-xs text-gray-500 dark:text-gray-400", formatCreatedAt(post?.createdAt))
  );
  authorLink.append(authorMeta);
  authorRow.append(authorLink);

  if (me && post.authorUid && post.authorUid !== me.uid) {
    const followBtn = createEl("button", "followOnPost shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold transition");
    followBtn.type = "button";
    authorRow.append(followBtn);

    const refreshFollowBtn = async () => {
      const following = await isFollowing(db, me.uid, post.authorUid);
      followBtn.textContent = following ? "Following" : "Follow";
      followBtn.className = following
        ? "followOnPost shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-600 transition"
        : "followOnPost shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition";
    };
    refreshFollowBtn();

    followBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const following = await isFollowing(db, me.uid, post.authorUid);
        if (following) {
          await unfollowUser(db, me.uid, post.authorUid);
          showToast("Unfollowed.", "info");
        } else {
          await followUser(db, me.uid, post.authorUid, window.__firebaseApp);
          showToast("Following!", "success");
        }
        await refreshFollowBtn();
      } catch (err) {
        showToast(err.message || "Could not follow.", "error");
      }
    });
  }

  const titleEl = createEl("h3", "text-xl font-bold text-gray-900 dark:text-white", post?.title || "Untitled post");
  header.append(authorRow, titleEl);

  const body = createEl("div", "space-y-5 px-5 py-5");

  if (post.type === "repost" && post.originalPostId) {
    body.append(createEl("p", "text-xs font-semibold text-accent", "↗ Reposted to feed"));
  }

  const text = createEl("p", "text-[15px] leading-7 text-gray-700 dark:text-gray-300");
  let formatted = formatTextWithHashtags(post?.text || "");
  formatted = formatTextWithMentions(formatted);
  text.innerHTML = formatted;
  body.append(text);

  const media = buildMediaNode(post);
  if (media) body.append(media);

  const statusEl = createEl("div", "text-sm text-rose-600 dark:text-rose-400 min-h-[1.25rem]");

  const actions = createEl("div", "flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-700 pt-4");

  const reactBtn = createEl("button", "inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold hover:border-accent transition");
  reactBtn.type = "button";
  reactBtn.textContent = "👍 React";

  const commentToggleBtn = createEl("button", "commentToggleBtn inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold hover:border-primary transition");
  commentToggleBtn.type = "button";
  commentToggleBtn.textContent = "💬 Comments";

  const shareBtn = createEl("button", "inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold transition");
  shareBtn.type = "button";
  shareBtn.textContent = "↗ Share";

  const repostBtn = createEl("button", "inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold hover:border-green-500 transition");
  repostBtn.type = "button";
  repostBtn.textContent = "🔁 Repost";

  const saveBtn = createEl("button", "inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold transition");
  saveBtn.type = "button";
  saveBtn.textContent = "🔖 Save";

  const flagBtn = createEl("button", "inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-rose-600 transition");
  flagBtn.type = "button";
  flagBtn.textContent = "🚩";

  if (me && post.authorUid === me.uid) {
    const editBtn = createEl("button", "inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold");
    editBtn.type = "button";
    editBtn.textContent = "✏ Edit";
    editBtn.dataset.editId = post.id;
    editBtn.dataset.editTitle = post.title || "";
    editBtn.dataset.editText = post.text || "";
    actions.append(editBtn);
  }

  const counts = createEl("div", "w-full flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400 mt-2");
  counts.innerHTML = `
    <button type="button" class="commentCountBtn rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition cursor-pointer"><span class="likeCount">${post.likeCount ?? 0}</span> reactions</button>
    <button type="button" class="commentCountBtn rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition cursor-pointer"><span class="commentCount">${post.commentCount ?? 0}</span> comments</button>
    <span class="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1"><span class="shareCount">${post.shareCount ?? 0}</span> shares</span>
  `;

  actions.append(reactBtn, commentToggleBtn, shareBtn, repostBtn, saveBtn, flagBtn);

  const commentsPanel = createEl("div", "commentsPanel hidden border-t border-gray-100 dark:border-gray-700 pt-4 mt-4");

  body.append(statusEl, actions, counts, commentsPanel);
  card.append(header, body);

  let myReaction = null;

  getMyReaction(db, post.id, me?.uid).then((r) => {
    myReaction = r;
    if (r) reactBtn.textContent = `${reactionEmoji(r)} Reacted`;
  });

  isPostSaved(window.__firebaseApp, post.id).then((saved) => {
    if (saved) saveBtn.textContent = "🔖 Saved";
  });

  const openComments = () => showCommentsPanel(card, post, commentsPanel, statusEl);
  const closeComments = () => hideCommentsPanel(post.id, commentsPanel);

  reactBtn.addEventListener("click", () => {
    showReactionPicker(reactBtn, async (reactionId) => {
      try {
        const result = await setReaction(window.__firebaseApp, post, reactionId);
        if (result.active) {
          reactBtn.textContent = `${reactionEmoji(result.reaction)} Reacted`;
          if (!myReaction) post.likeCount = (post.likeCount ?? 0) + 1;
          myReaction = result.reaction;
        } else {
          reactBtn.textContent = "👍 React";
          if (myReaction) post.likeCount = Math.max(0, (post.likeCount ?? 0) - 1);
          myReaction = null;
        }
        updateCountsOnCard(card, post);
      } catch (err) {
        statusEl.textContent = err.message;
      }
    });
  });

  commentToggleBtn.addEventListener("click", () => {
    if (commentsPanel.classList.contains("hidden")) openComments();
    else closeComments();
  });

  counts.querySelectorAll(".commentCountBtn").forEach((btn, i) => {
    btn.addEventListener("click", () => {
      if (i === 1) openComments();
    });
  });

  shareBtn.addEventListener("click", async () => {
    try {
      const result = await toggleShare(window.__firebaseApp, post);
      post.shareCount = Math.max(0, (post.shareCount ?? 0) + (result.shared ? 1 : -1));
      updateCountsOnCard(card, post);
    } catch (err) {
      statusEl.textContent = err.message;
    }
  });

  repostBtn.addEventListener("click", async () => {
    const caption = await promptTextInput({
      title: "Repost to your feed",
      placeholder: "Say something about this post (optional)",
      maxLength: 140,
    });
    if (caption === null) return;
    await repostToFeed(window.__firebaseApp, post, caption);
  });

  saveBtn.addEventListener("click", async () => {
    try {
      const result = await toggleSave(window.__firebaseApp, post.id);
      saveBtn.textContent = result.saved ? "🔖 Saved" : "🔖 Save";
      showToast(result.saved ? "Post saved." : "Removed from saved.", "info");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  flagBtn.addEventListener("click", () => flagPost(post.id));

  card.dataset.commentsReady = "1";
  return card;
}
