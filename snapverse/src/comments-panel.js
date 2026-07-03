import { query, orderBy, onSnapshot, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { commentsCol, addComment } from "./comments.js";
import { profileUrl } from "./profiles-cache.js";
import { showToast, showReactionPicker } from "./ui.js";
import { getCurrentUser } from "./auth.js";

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

function renderCommentNode(c, { onReply, onReact, depth = 0 }) {
  const wrap = document.createElement("div");
  wrap.className = `rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3 ${depth > 0 ? 'ml-4 mt-2 border-l-2 border-accent/20 pl-3' : ''}`;
  wrap.dataset.commentId = c.id;

  const profileHref = c.authorUid ? profileUrl(c.authorUid) : "#";
  const nameLink = c.authorUid
    ? `<a href="${profileHref}" class="text-sm font-bold text-gray-900 dark:text-white hover:text-accent">${escapeHtml(authorName(c))}</a>`
    : `<span class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(authorName(c))}</span>`;

  // Calculate reactions
  const reactions = c.reactions || {};
  const reactionCount = Object.values(reactions).reduce((sum, uids) => sum + uids.length, 0);
  const user = getCurrentUser();
  const myReactions = Object.entries(reactions).filter(([_, uids]) => uids.includes(user?.uid)).map(([emoji]) => emoji);

  // Show reply context if this is a reply
  let replyContext = '';
  if (c.parentCommentId && depth === 0) {
    replyContext = `<div class="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
      <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
      Replying to a comment
    </div>`;
  }

  wrap.innerHTML = `
    ${replyContext}
    <div class="flex items-center gap-2 mb-1">
      ${nameLink}
      <span class="text-xs text-gray-500">${formatTime(c.createdAt)}</span>
    </div>
    <p class="text-sm text-gray-700 dark:text-gray-300">${escapeHtml(c.text)}</p>
    <div class="flex items-center gap-3 mt-2">
      <button type="button" class="reactBtn text-xs font-semibold text-gray-500 hover:text-accent transition flex items-center gap-1">
        ${myReactions.length > 0 ? myReactions[0] : '👍'} ${reactionCount > 0 ? reactionCount : 'React'}
      </button>
      <button type="button" class="replyBtn text-xs font-semibold text-accent hover:underline">Reply</button>
    </div>
  `;

  wrap.querySelector(".replyBtn").addEventListener("click", () => onReply(c.id));
  wrap.querySelector(".reactBtn").addEventListener("click", (e) => {
    if (onReact) onReact(c.id, e.target.closest(".reactBtn"));
  });
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

  const handleCommentReaction = async (commentId, btn) => {
    const user = getCurrentUser();
    if (!user) return showToast("Sign in to react to comments.", "error");
    
    showReactionPicker(btn, async (emoji) => {
      try {
        const db = firebaseApp.__db;
        const commentRef = doc(db, "posts", post.id, "comments", commentId);
        const commentSnap = await getDoc(commentRef);
        const commentData = commentSnap.data();
        
        const reactions = commentData.reactions || {};
        const emojiReactors = reactions[emoji] || [];
        
        if (emojiReactors.includes(user.uid)) {
          // Remove reaction
          reactions[emoji] = emojiReactors.filter(uid => uid !== user.uid);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          // Add reaction
          reactions[emoji] = [...emojiReactors, user.uid];
        }
        
        await updateDoc(commentRef, { reactions });
        showToast("Reaction updated!", "success");
      } catch (err) {
        showToast("Failed to react: " + err.message, "error");
      }
    });
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

    const renderReplies = (commentId, depth = 1) => {
      const replies = byParent.get(commentId) || [];
      if (replies.length === 0) return null;
      
      const repliesWrap = document.createElement("div");
      repliesWrap.className = depth === 1 ? "ml-4 mt-2 space-y-2 border-l-2 border-accent/20 pl-3" : "ml-4 mt-2 space-y-2";
      
      replies.forEach((r) => {
        const commentNode = renderCommentNode(r, { 
          onReply: depth < 3 ? (parentId) => openReplyForm(parentId) : () => {},
          onReact: (commentId, btn) => handleCommentReaction(commentId, btn),
          depth
        });
        repliesWrap.appendChild(commentNode);
        
        // Render nested replies (up to 3 levels deep)
        if (depth < 3) {
          const nestedReplies = renderReplies(r.id, depth + 1);
          if (nestedReplies) repliesWrap.appendChild(nestedReplies);
        }
      });
      
      return repliesWrap;
    };

    topLevel.forEach((c) => {
      const block = document.createElement("div");
      block.className = "space-y-2";
      block.appendChild(renderCommentNode(c, { 
        onReply: (parentId) => openReplyForm(parentId),
        onReact: (commentId, btn) => handleCommentReaction(commentId, btn),
        depth: 0
      }));

      const replies = renderReplies(c.id, 1);
      if (replies) block.appendChild(replies);
      
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
