import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { toggleLike } from "./likes.js";
import { addComment } from "./comments.js";
import { toggleShare } from "./shares.js";
import { formatTextWithHashtags } from "./hashtags.js";
import { formatTextWithMentions } from "./mentions.js";
import { getCurrentUser } from "./auth.js";

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function formatCreatedAt(createdAt) {
  if (createdAt?.toDate) {
    return createdAt.toDate().toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  if (typeof createdAt === "string" && createdAt.trim()) return createdAt;
  return "Just now";
}

function getAuthorLabel(post) {
  return post?.authorEmail || post?.authorUid || "Community member";
}

async function flagPost(postId, reason) {
  const user = getCurrentUser();
  if (!user) {
    alert("You must be logged in to flag a post.");
    return;
  }

  const firebase = window.firebaseApp;
  const db = firebase.__db;

  await addDoc(collection(db, "flags"), {
    postId,
    reason,
    reporterUid: user.uid,
    reporterEmail: user.email || null,
    createdAt: serverTimestamp(),
    status: "pending"
  });

  alert("Post flagged for review. Thank you for helping keep our community safe.");
}

function buildMediaNode(post) {
  if (!post?.mediaUrl) return null;

  const wrap = createEl("div", "overflow-hidden rounded-2xl border border-gray-200 bg-gray-50");
  if (post.mediaType === "video") {
    const video = document.createElement("video");
    video.className = "w-full max-h-[520px] bg-black object-contain";
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
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

function buildActionButton(label, icon, className, dataPostId, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = [
    "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition",
    className,
    extraClass,
  ]
    .filter(Boolean)
    .join(" ");
  button.dataset.postId = dataPostId;

  const iconSpan = createEl("span", "text-base", icon);
  const labelSpan = createEl("span", null, label);
  button.append(iconSpan, labelSpan);
  return button;
}

function renderPostCard(post, db) {
  const card = createEl(
    "article",
    "overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
  );

  const header = createEl("div", "flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-700 px-5 py-5");
  const authorWrap = createEl("div", "flex min-w-0 items-center gap-3");

  const avatar = createEl(
    "div",
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white shadow-sm",
    (getAuthorLabel(post).charAt(0) || "S").toUpperCase()
  );

  const authorMeta = createEl("div", "min-w-0");
  const title = createEl("h3", "truncate text-xl font-bold tracking-tight text-gray-900 dark:text-white", post?.title || "Untitled post");
  const author = createEl("p", "truncate text-sm font-medium text-gray-500 dark:text-gray-400", getAuthorLabel(post));
  authorMeta.append(title, author);
  authorWrap.append(avatar, authorMeta);

  const time = createEl("div", "shrink-0 text-right");
  const timeLabel = createEl("p", "text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500", "Published");
  const timeValue = createEl("p", "mt-1 text-sm font-medium text-gray-600 dark:text-gray-400", formatCreatedAt(post?.createdAt));
  time.append(timeLabel, timeValue);
  header.append(authorWrap, time);

  const body = createEl("div", "space-y-5 px-5 py-5");
  const text = createEl("p", "text-[15px] leading-7 text-gray-700 dark:text-gray-300");
  let formattedText = formatTextWithHashtags(post?.text || "");
  formattedText = formatTextWithMentions(formattedText);
  text.innerHTML = formattedText;
  body.append(text);

  const media = buildMediaNode(post);
  if (media) body.append(media);

  const statusRow = createEl("div", "flex flex-wrap items-center gap-2");
  const vibe = createEl("span", "inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent", "Live post");
  const statusEl = createEl("div", "ml-auto text-sm text-rose-600 dark:text-rose-400");
  statusEl.dataset.postStatus = post.id;
  statusRow.append(vibe, statusEl);

  const actions = createEl("div", "flex flex-wrap items-center gap-3 border-t border-gray-100 dark:border-gray-700 pt-5");

  const likeBtn = buildActionButton("Like", "♥", "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-accent hover:text-accent hover:bg-accent/5", post.id);
  likeBtn.classList.add("likeBtn");

  const commentBtn = buildActionButton("Comment", "✎", "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary hover:bg-primary/5", post.id);
  commentBtn.classList.add("commentBtn");

  const shareBtn = buildActionButton("Share", "↗", "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-secondary hover:text-secondary hover:bg-secondary/5", post.id);
  shareBtn.classList.add("shareBtn");

  // Add social share buttons
  const socialShareDiv = createEl("div", "flex gap-2 ml-auto");
  
  const twitterBtn = document.createElement("button");
  twitterBtn.type = "button";
  twitterBtn.className = "p-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-400 transition";
  twitterBtn.innerHTML = `<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>`;
  twitterBtn.addEventListener("click", () => {
    const text = encodeURIComponent(`${post.title || ""} ${post.text || ""}`);
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  });

  const facebookBtn = document.createElement("button");
  facebookBtn.type = "button";
  facebookBtn.className = "p-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-600 hover:text-blue-600 transition";
  facebookBtn.innerHTML = `<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
  facebookBtn.addEventListener("click", () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
  });

  socialShareDiv.append(twitterBtn, facebookBtn);

  // Add flag button for content moderation
  const flagBtn = document.createElement("button");
  flagBtn.type = "button";
  flagBtn.className = "inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-rose-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition";
  flagBtn.innerHTML = `<span>🚩</span><span>Flag</span>`;
  flagBtn.dataset.flagId = post.id;
  flagBtn.addEventListener("click", () => {
    const reason = prompt("Why are you flagging this post?");
    if (reason) {
      flagPost(post.id, reason);
    }
  });
  actions.appendChild(flagBtn);

  // Add edit button for own posts
  const user = window.currentFirebaseUser;
  if (user && post.authorUid === user.uid) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-accent hover:text-accent hover:bg-accent/5 transition";
    editBtn.innerHTML = `<span>✏</span><span>Edit</span>`;
    editBtn.dataset.editId = post.id;
    editBtn.dataset.editTitle = post.title || "";
    editBtn.dataset.editText = post.text || "";
    actions.appendChild(editBtn);
  }

  const counts = createEl("div", "ml-auto flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400");
  counts.innerHTML = `
    <span class="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1"><span class="likeCount">0</span> likes</span>
    <span class="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1"><span class="commentCount">0</span> comments</span>
    <span class="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1"><span class="shareCount">0</span> shares</span>
  `;

  actions.append(likeBtn, commentBtn, shareBtn, socialShareDiv, counts);

  const commentForm = createEl("form", "flex flex-col gap-3 border-t border-gray-100 dark:border-gray-700 pt-5 md:flex-row md:items-center");
  commentForm.dataset.postId = post.id;
  commentForm.dataset.parentCommentId = ""; // Empty for top-level comments

  const commentInput = document.createElement("input");
  commentInput.className =
    "flex-1 rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm outline-none transition focus:border-accent focus:bg-white dark:focus:bg-gray-600 focus:ring-4 focus:ring-accent/10 text-gray-900 dark:text-white";
  commentInput.type = "text";
  commentInput.maxLength = 200;
  commentInput.placeholder = "Write a thoughtful comment...";
  commentInput.required = true;

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className =
    "inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary";
  submit.textContent = "Post comment";

  commentForm.append(commentInput, submit);

  body.append(statusRow, actions, commentForm);
  card.append(header, body);

  const refreshCounts = async () => {
    try {
      const [likesSnap, commentsSnap, sharesSnap] = await Promise.all([
        getDocs(collection(db, "posts", post.id, "likes")),
        getDocs(collection(db, "posts", post.id, "comments")),
        getDocs(collection(db, "posts", post.id, "shares")),
      ]);

      card.querySelector(".likeCount").textContent = String(likesSnap.size);
      card.querySelector(".commentCount").textContent = String(commentsSnap.size);
      card.querySelector(".shareCount").textContent = String(sharesSnap.size);
    } catch {
      statusEl.textContent = "Unable to load counts.";
    }
  };

  refreshCounts();

  likeBtn.addEventListener("click", async () => {
    statusEl.textContent = "";
    try {
      await toggleLike(window.__firebaseApp, post);
      await refreshCounts();
    } catch (err) {
      statusEl.textContent = err?.message || "Like failed.";
    }
  });

  shareBtn.addEventListener("click", async () => {
    statusEl.textContent = "";
    try {
      await toggleShare(window.__firebaseApp, post);
      await refreshCounts();
    } catch (err) {
      statusEl.textContent = err?.message || "Share failed.";
    }
  });

  commentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "";

    try {
      await addComment(window.__firebaseApp, post, commentInput.value);
      commentInput.value = "";
      await refreshCounts();
    } catch (err) {
      statusEl.textContent = err?.message || "Comment failed.";
    }
  });

  return card;
}

export function startFeed(firebaseApp) {
  window.__firebaseApp = firebaseApp;

  const db = getDbService(firebaseApp);
  const feedEl = document.getElementById("feed");
  const feedEmptyEl = document.getElementById("feedEmpty");
  const feedCountEl = document.getElementById("feedCount");

  const postsCol = collection(db, "posts");
  const q = query(postsCol, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    const posts = [];
    snapshot.forEach((docSnap) => posts.push({ id: docSnap.id, ...docSnap.data() }));

    feedEl.innerHTML = "";
    feedEmptyEl.classList.toggle("hidden", posts.length > 0);

    posts.forEach((post) => {
      feedEl.appendChild(renderPostCard(post, db));
    });

    feedCountEl.textContent = `${posts.length} post${posts.length === 1 ? "" : "s"}`;
  });
}
