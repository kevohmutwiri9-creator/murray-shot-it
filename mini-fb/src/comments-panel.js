import { query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { commentsCol, addComment } from "./comments.js";
import { profileUrl } from "./profiles-cache.js";
import { showToast } from "./ui.js";

function authorName(c) {
  return c.authorEmail?.split("@")[0] || "User";
}

function formatTime(createdAt) {
  if (createdAt?.toDate) return createdAt.toDate().toLocaleString();
  return "Just now";
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderCommentNode(c, { onReply }) {
  const wrap = document.createElement("div");
  wrap.className = "rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3";
  wrap.dataset.commentId = c.id;

  const profileHref = c.authorUid ? profileUrl(c.authorUid) : "#";
  const nameLink = c.authorUid
    ? `<a href="${profileHref}" class="text-sm font-bold text-gray-900 dark:text-white hover:text-accent">${escapeHtml(authorName(c))}</a>`
    : `<span class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(authorName(c))}</span>`;

  wrap.innerHTML = `
    <div class="flex items-center gap-2 mb-1">
      ${nameLink}
      <span class="text-xs text-gray-500">${formatTime(c.createdAt)}</span>
    </div>
    <p class="text-sm text-gray-700 dark:text-gray-300">${escapeHtml(c.text)}</p>
    <button type="button" class="replyBtn mt-2 text-xs font-semibold text-accent hover:underline">Reply</button>
  `;

  wrap.querySelector(".replyBtn").addEventListener("click", () => onReply(c.id));
  return wrap;
}

export function mountCommentsPanel(firebaseApp, post, container, statusEl) {
  container.innerHTML = '<p class="text-sm text-gray-500">Loading comments...</p>';
  const db = firebaseApp.__db;
  const col = commentsCol(db, post.id);
  const q = query(col, orderBy("createdAt", "asc"));

  const openReplyForm = (parentId) => {
    const existing = container.querySelector(`[data-reply-form="${parentId}"]`);
    if (existing) {
      existing.remove();
      return;
    }
    const form = document.createElement("form");
    form.dataset.replyForm = parentId;
    form.className = "flex gap-2 mt-2 ml-4";
    form.innerHTML = `
      <input type="text" maxlength="200" required placeholder="Write a reply..." class="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
      <button type="submit" class="px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold">Reply</button>
    `;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      try {
        await addComment(firebaseApp, post, input.value, parentId);
        form.remove();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
    container.appendChild(form);
    form.querySelector("input").focus();
  };

  const render = (comments) => {
    container.innerHTML = "";
    const topLevel = comments.filter((c) => !c.parentCommentId);
    const byParent = new Map();
    comments.forEach((c) => {
      if (c.parentCommentId) {
        if (!byParent.has(c.parentCommentId)) byParent.set(c.parentCommentId, []);
        byParent.get(c.parentCommentId).push(c);
      }
    });

    if (topLevel.length === 0) {
      container.innerHTML =
        '<p class="text-sm text-gray-500 dark:text-gray-400">No comments yet. Be the first!</p>';
    }

    topLevel.forEach((c) => {
      const block = document.createElement("div");
      block.className = "space-y-2";
      block.appendChild(renderCommentNode(c, { onReply: (parentId) => openReplyForm(parentId) }));

      const replies = byParent.get(c.id) || [];
      if (replies.length) {
        const repliesWrap = document.createElement("div");
        repliesWrap.className = "ml-4 mt-2 space-y-2 border-l-2 border-accent/20 pl-3";
        replies.forEach((r) => repliesWrap.appendChild(renderCommentNode(r, { onReply: () => {} })));
        block.appendChild(repliesWrap);
      }
      container.appendChild(block);
    });

    const mainForm = document.createElement("form");
    mainForm.className = "flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700";
    mainForm.innerHTML = `
      <input type="text" maxlength="200" required placeholder="Write a comment..." class="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
      <button type="submit" class="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold">Post</button>
    `;
    mainForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = mainForm.querySelector("input");
      try {
        await addComment(firebaseApp, post, input.value, null);
        input.value = "";
      } catch (err) {
        showToast(err.message, "error");
      }
    });
    container.appendChild(mainForm);
  };

  return onSnapshot(
    q,
    (snap) => {
      const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render(comments);
    },
    (err) => {
      container.innerHTML = `<p class="text-sm text-rose-500">Could not load comments: ${err.message || "error"}</p>`;
    }
  );
}
