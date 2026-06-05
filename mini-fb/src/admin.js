import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser, isAdmin } from "./auth.js";
import { uploadMedia } from "./image-upload.js";
import { extractHashtags, saveHashtags } from "./hashtags.js";
import { extractMentions, saveMentions, notifyMentionedUsers } from "./mentions.js";
import { checkRateLimit, recordRateLimit } from "./rate-limit.js";
import { INITIAL_POST_STATS } from "./post-stats.js";
import { showToast } from "./ui.js";

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
  return post?.authorEmail || post?.authorUid || "User";
}

function renderMediaPreview(post) {
  if (!post?.mediaUrl) return null;

  const wrap = createEl("div", "overflow-hidden rounded-2xl border border-slate-200 bg-slate-50");
  if (post.mediaType === "video") {
    const video = document.createElement("video");
    video.className = "w-full max-h-[280px] bg-black object-contain";
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = post.mediaUrl;
    wrap.appendChild(video);
    return wrap;
  }

  const img = document.createElement("img");
  img.className = "w-full max-h-[280px] object-cover";
  img.alt = post.title || "Post media";
  img.loading = "lazy";
  img.src = post.mediaUrl;
  wrap.appendChild(img);
  return wrap;
}

function renderAdminPostCard(post) {
  const card = createEl(
    "article",
    "rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
  );

  const top = createEl("div", "flex items-start justify-between gap-4");
  const content = createEl("div", "min-w-0 flex-1 space-y-3");

  const header = createEl("div", "flex items-center gap-3");
  const badge = createEl(
    "div",
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white",
    (getAuthorLabel(post).charAt(0) || "S").toUpperCase()
  );

  const headingWrap = createEl("div", "min-w-0");
  const title = createEl("h3", "truncate text-lg font-bold text-slate-900 dark:text-white", post?.title || "Untitled post");
  const meta = createEl("p", "truncate text-sm font-medium text-slate-500 dark:text-slate-400", `${getAuthorLabel(post)} • ${formatCreatedAt(post?.createdAt)}`);
  headingWrap.append(title, meta);
  header.append(badge, headingWrap);

  const text = createEl("p", "text-sm leading-6 text-slate-700 dark:text-slate-300", post?.text || "");

  content.append(header, text);

  const mediaPreview = renderMediaPreview(post);
  if (mediaPreview) content.append(mediaPreview);

  if (post?.mediaUrl) {
    const mediaLine = createEl("p", "break-all text-xs text-slate-500 dark:text-slate-400");
    mediaLine.textContent = `Media: ${post.mediaUrl}`;
    content.append(mediaLine);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className =
    "inline-flex shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100";
  deleteBtn.dataset.deleteId = post.id;
  deleteBtn.textContent = "Delete";

  top.append(content, deleteBtn);
  card.append(top);

  return card;
}

async function getCollectionCount(colRef) {
  const snap = await getDocs(colRef);
  return snap.size;
}

export function renderAdminPosts(firebaseApp, { containerEl, emptyEl, onDelete }) {
  const db = getDbService(firebaseApp);
  const postsCol = collection(db, "posts");
  const q = query(postsCol, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    const posts = [];
    snapshot.forEach((docSnap) => posts.push({ id: docSnap.id, ...docSnap.data() }));

    containerEl.innerHTML = "";

    if (posts.length === 0) {
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");

    posts.forEach((post) => {
      const card = renderAdminPostCard(post);
      const btn = card.querySelector("[data-delete-id]");
      btn?.addEventListener("click", async () => {
        const ok = confirm("Delete this post? This cannot be undone.");
        if (!ok) return;
        await onDelete(post.id);
      });
      containerEl.appendChild(card);
    });
  });
}

/**
 * Any logged-in user can publish.
 * Admin gating is handled only on admin.html moderation actions (delete).
 */
export function bindCreatePost(firebaseApp, { titleEl, textEl, fileEl, scheduleEl, visibilityEl, kindEl, formEl, btnEl, statusEl }) {
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    btnEl.disabled = true;
    statusEl.textContent = "";

    try {
      const user = getCurrentUser();
      if (!user) throw new Error("Not logged in.");
      checkRateLimit("post", user.uid);

      const title = titleEl.value.trim();
      const text = textEl.value.trim();
      const file = fileEl.files?.[0];
      const scheduledTime = scheduleEl?.value ? new Date(scheduleEl.value) : null;
      const postKind = kindEl?.value === "reel" ? "reel" : "post";

      if (!title) throw new Error("Title is required.");
      if (!text) throw new Error("Text is required.");

      if (scheduledTime && scheduledTime <= new Date()) {
        throw new Error("Scheduled time must be in the future.");
      }

      statusEl.textContent = scheduledTime ? "Scheduling post..." : "Publishing post...";

      let mediaUrl = null;
      let mediaType = null;
      let mediaUrls = [];
      const files = fileEl?.files?.length ? [...fileEl.files] : file ? [file] : [];
      if (postKind === "reel") {
        if (files.length !== 1) throw new Error("Reels require exactly 1 video file.");
        if (!files[0].type.startsWith("video/")) throw new Error("Reels must be uploaded as video.");
      }

      for (let i = 0; i < Math.min(files.length, 5); i++) {
        statusEl.textContent = `Uploading media ${i + 1}/${Math.min(files.length, 5)}...`;
        const uploadResult = await uploadMedia(files[i], {
          firebaseApp,
          uid: user.uid,
          onProgress: (pct) => {
            statusEl.textContent = `Uploading media ${i + 1}/${Math.min(files.length, 5)}... ${pct}%`;
          },
        });
        mediaUrls.push({ url: uploadResult.url, type: uploadResult.mediaType });
      }
      if (mediaUrls[0]) {
        mediaUrl = mediaUrls[0].url;
        mediaType = mediaUrls[0].type;
      }

      const db = getDbService(firebaseApp);

      const visibility = visibilityEl?.value === "followers" ? "followers" : "public";

      const postRef = await addDoc(collection(db, "posts"), {
        title,
        text,
        mediaUrl,
        mediaType,
        mediaUrls: mediaUrls.length ? mediaUrls : null,
        authorUid: user.uid,
        authorEmail: user.email || null,
        createdAt: serverTimestamp(),
        scheduledFor: scheduledTime ? scheduledTime.toISOString() : null,
        status: scheduledTime ? "scheduled" : "published",
        visibility,
        type: postKind,
        ...INITIAL_POST_STATS,
      });

      // Extract and save hashtags
      const hashtags = extractHashtags(text);
      await saveHashtags(db, postRef.id, hashtags);

      // Extract and save mentions
      const mentions = extractMentions(text);
      await saveMentions(db, postRef.id, mentions);
      if (!scheduledTime) {
        await notifyMentionedUsers(firebaseApp, {
          postId: postRef.id,
          text,
          actorUid: user.uid,
          actorEmail: user.email,
        });
      }
      recordRateLimit("post", user.uid);

      statusEl.textContent = scheduledTime
        ? `${postKind === "reel" ? "Reel" : "Post"} scheduled successfully.`
        : `${postKind === "reel" ? "Reel" : "Post"} published successfully.`;
      showToast(statusEl.textContent, "success");
      titleEl.value = "";
      textEl.value = "";
      fileEl.value = "";
      if (scheduleEl) scheduleEl.value = "";
    } catch (err) {
      const msg = err?.message || "Failed to publish post.";
      statusEl.textContent = msg;
      showToast(msg, "error");
    } finally {
      btnEl.disabled = false;
    }
  });
}

// Backward-compatible alias
export { bindCreatePost as adminBindCreatePost };

export async function adminDeletePost(firebaseApp, postId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in.");

  const admin = await isAdmin(firebaseApp, user.uid);
  if (!admin) throw new Error("Access denied: not an admin.");

  const db = getDbService(firebaseApp);

  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);

  if (!postSnap.exists()) return;

  await deleteDoc(postRef);
  // Note: Images hosted on imgbb cannot be programmatically deleted without their API
  // For now, we just delete the post reference. The image will remain on imgbb.
}
