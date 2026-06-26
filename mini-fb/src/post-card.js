import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
import { getReactionSummary, formatReactionSummaryBar } from "./reaction-summary.js";
import { deleteMyPost } from "./posts.js";
import { processTip, dollarsToCents, formatBalance } from "./transactions.js";

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

function showTipModal(toUserId, postId) {
  const getTillNumber = () => import.meta.env?.VITE_TILL_NUMBER || process.env?.TILL_NUMBER || '';
  const getTillAccountName = () => import.meta.env?.VITE_TILL_ACCOUNT_NAME || process.env?.TILL_ACCOUNT_NAME || '';
  
  const tillNumber = getTillNumber();
  const tillAccountName = getTillAccountName();
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Send a Tip</h2>
      
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 mb-4 border border-green-200 dark:border-green-800">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Pay via Till Number</p>
        <p class="text-2xl font-bold text-green-600 dark:text-green-400">${tillNumber || 'Contact support for payment info'}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${tillAccountName}</p>
      </div>
      
      <div class="space-y-3 mb-4">
        <button class="tip-amount w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-accent transition text-lg font-semibold" data-amount="1">$1</button>
        <button class="tip-amount w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-accent transition text-lg font-semibold" data-amount="5">$5</button>
        <button class="tip-amount w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-accent transition text-lg font-semibold" data-amount="10">$10</button>
        <button class="tip-amount w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-accent transition text-lg font-semibold" data-amount="25">$25</button>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Custom amount</label>
        <input type="number" id="customTipAmount" class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white" placeholder="Enter amount" min="1" step="0.01">
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Transaction ID / M-Pesa Code</label>
        <input type="text" id="tipTransactionId" class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white" placeholder="Enter your transaction ID" />
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
        <input type="tel" id="tipPhoneNumber" class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white" placeholder="e.g., 0712345678" />
      </div>
      
      <div class="flex gap-3">
        <button id="sendTipBtn" class="flex-1 px-4 py-2 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition">Send Tip</button>
        <button id="cancelTipBtn" class="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  let selectedAmount = 0;
  
  modal.querySelectorAll('.tip-amount').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.tip-amount').forEach(b => b.classList.remove('border-accent', 'bg-accent/10'));
      btn.classList.add('border-accent', 'bg-accent/10');
      selectedAmount = parseFloat(btn.dataset.amount);
      document.getElementById('customTipAmount').value = '';
    });
  });
  
  const customInput = document.getElementById('customTipAmount');
  customInput.addEventListener('input', () => {
    modal.querySelectorAll('.tip-amount').forEach(b => b.classList.remove('border-accent', 'bg-accent/10'));
    selectedAmount = parseFloat(customInput.value) || 0;
  });
  
  document.getElementById('sendTipBtn').addEventListener('click', async () => {
    const amount = selectedAmount || parseFloat(customInput.value);
    const transactionId = document.getElementById('tipTransactionId').value;
    const phoneNumber = document.getElementById('tipPhoneNumber').value;
    
    if (!amount || amount < 0.01) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    
    if (!transactionId || !phoneNumber) {
      showToast('Please enter transaction ID and phone number', 'error');
      return;
    }
    
    if (!tillNumber) {
      showToast('Payment system not configured. Please contact support.', 'error');
      return;
    }
    
    try {
      const db = window.__firebaseApp.__db;
      const user = getCurrentUser();
      
      // Create payment record
      const { addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      await addDoc(collection(db, 'payments'), {
        fromUserId: user.uid,
        toUserId,
        amount: dollarsToCents(amount),
        description: `Tip for post ${postId}`,
        transactionId,
        phoneNumber,
        status: 'pending',
        paymentMethod: 'till',
        createdAt: serverTimestamp(),
      });
      
      // Process tip
      await processTip(db, user.uid, toUserId, dollarsToCents(amount), `Tip for post ${postId}`);
      showToast(`Tip of ${formatBalance(dollarsToCents(amount))} sent!`, 'success');
      modal.remove();
    } catch (err) {
      showToast(err.message || 'Failed to send tip', 'error');
    }
  });
  
  document.getElementById('cancelTipBtn').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function normalizeMediaList(post) {
  if (post?.mediaUrls?.length) {
    return post.mediaUrls.map((m) =>
      typeof m === "string" ? { url: m, type: "image" } : { url: m.url, type: m.type || "image" }
    );
  }
  if (post?.mediaUrl) return [{ url: post.mediaUrl, type: post.mediaType || "image" }];
  return [];
}

function buildMediaNode(post) {
  const items = normalizeMediaList(post);
  if (!items.length) return null;

  const wrap = createEl("div", "overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900");

  if (items.length === 1) {
    const m = items[0];
    if (m.type === "video") {
      const video = document.createElement("video");
      video.className = "w-full max-h-[520px] bg-black object-contain";
      video.controls = true;
      video.playsInline = true;
      video.src = m.url;
      wrap.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.className = "w-full max-h-[520px] object-cover";
      img.alt = post.title || "Post media";
      img.loading = "lazy";
      img.src = m.url;
      wrap.appendChild(img);
    }
    return wrap;
  }

  const track = createEl("div", "flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1");
  items.forEach((m, i) => {
    const slide = createEl("div", "min-w-[85%] snap-center shrink-0");
    if (m.type === "video") {
      const video = document.createElement("video");
      video.className = "w-full max-h-[400px] bg-black object-contain rounded-xl";
      video.controls = true;
      video.playsInline = true;
      video.src = m.url;
      slide.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.className = "w-full max-h-[400px] object-cover rounded-xl";
      img.alt = `${post.title || "Post"} ${i + 1}`;
      img.loading = "lazy";
      img.src = m.url;
      slide.appendChild(img);
    }
    track.appendChild(slide);
  });
  wrap.appendChild(track);
  wrap.appendChild(createEl("p", "text-xs text-gray-500 px-2 py-1", `${items.length} photos`));
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

function openPostDetail(postId) {
  // Create modal for post detail
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in';
  modal.id = 'postDetailModal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-scale-in';
  
  const modalHeader = document.createElement('div');
  modalHeader.className = 'flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700';
  modalHeader.innerHTML = `
    <h2 class="text-lg font-bold text-gray-900 dark:text-white">Post Details</h2>
    <button type="button" class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition">
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;
  
  const modalBody = document.createElement('div');
  modalBody.className = 'p-4 overflow-y-auto max-h-[70vh]';
  modalBody.innerHTML = '<p class="text-center text-gray-500">Loading post...</p>';
  
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Close button handler
  modalHeader.querySelector('button').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Load post content
  const originalCard = document.getElementById(`post-${postId}`);
  if (originalCard) {
    modalBody.innerHTML = '';
    modalBody.appendChild(originalCard.cloneNode(true));
  } else {
    // If card not found, fetch from Firestore
    const db = window.__firebaseApp.__db;
    getDoc(doc(db, "posts", postId)).then((docSnap) => {
      if (docSnap.exists()) {
        const post = { id: docSnap.id, ...docSnap.data() };
        modalBody.innerHTML = '';
        modalBody.appendChild(renderPostCard(post, db));
      } else {
        modalBody.innerHTML = '<p class="text-center text-gray-500">Post not found</p>';
      }
    }).catch(() => {
      modalBody.innerHTML = '<p class="text-center text-rose-500">Could not load post</p>';
    });
  }
}

export function renderPostCard(post, db) {
  const card = createEl(
    "article",
    "overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-[0_18px_40px_rgba(15,23,42,0.08)] scroll-mt-24 cursor-pointer hover:shadow-lg transition-shadow"
  );
  card.id = `post-${post.id}`;
  card.dataset.postId = post.id;
  const me = window.currentFirebaseUser;

  // Add click handler to open post detail view
  card.addEventListener('click', (e) => {
    // Don't trigger if clicking on interactive elements
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('textarea')) {
      return;
    }
    openPostDetail(post.id);
  });

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

  const sendDmBtn = createEl("button", "inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold hover:border-blue-500 transition");
  sendDmBtn.type = "button";
  sendDmBtn.textContent = "✉ Send";

  const tipBtn = createEl("button", "inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold hover:border-yellow-500 transition");
  tipBtn.type = "button";
  tipBtn.textContent = "💰 Tip";

  if (me && post.authorUid === me.uid) {
    const editBtn = createEl("button", "inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold");
    editBtn.type = "button";
    editBtn.textContent = "✏ Edit";
    editBtn.dataset.editId = post.id;
    editBtn.dataset.editTitle = post.title || "";
    editBtn.dataset.editText = post.text || "";

    const deleteBtn = createEl("button", "inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800 px-3 py-2 text-sm font-semibold text-rose-600 transition");
    deleteBtn.type = "button";
    deleteBtn.textContent = "🗑 Delete";
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this post permanently?")) return;
      try {
        await deleteMyPost(window.__firebaseApp, post.id);
        card.remove();
        showToast("Post deleted.", "success");
      } catch (err) {
        showToast(err.message || "Delete failed.", "error");
      }
    });
    actions.append(editBtn, deleteBtn);
  } else if (me && post.authorUid) {
    sendDmBtn.addEventListener("click", () => {
      const link = encodeURIComponent(`${location.origin}/index.html?post=${post.id}`);
      window.location.href = `/mini-fb/messages.html?uid=${encodeURIComponent(post.authorUid)}&sharePost=${link}`;
    });
    actions.append(sendDmBtn);
    
    // Add tip button for other users' posts
    if (post.authorUid !== me.uid) {
      tipBtn.addEventListener("click", () => {
        showTipModal(post.authorUid, post.id);
      });
      actions.append(tipBtn);
    }
  }

  const counts = createEl("div", "w-full flex flex-col gap-2 text-sm text-gray-500 dark:text-gray-400 mt-2");
  const reactionBar = createEl("p", "reactionSummaryBar text-sm font-medium text-gray-700 dark:text-gray-300 hidden");
  const countRow = createEl("div", "flex flex-wrap gap-2");
  countRow.innerHTML = `
    <button type="button" class="commentCountBtn rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition cursor-pointer"><span class="likeCount">${post.likeCount ?? 0}</span> reactions</button>
    <button type="button" class="commentCountBtn rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition cursor-pointer"><span class="commentCount">${post.commentCount ?? 0}</span> comments</button>
    <span class="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1"><span class="shareCount">${post.shareCount ?? 0}</span> shares</span>
  `;
  counts.append(reactionBar, countRow);

  actions.append(reactBtn, commentToggleBtn, shareBtn, repostBtn, saveBtn, flagBtn);

  getReactionSummary(db, post.id).then((summary) => {
    if (summary.total > 0) {
      reactionBar.textContent = formatReactionSummaryBar(summary);
      reactionBar.classList.remove("hidden");
    }
  });

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
        getReactionSummary(db, post.id).then((summary) => {
          const bar = card.querySelector(".reactionSummaryBar");
          if (!bar) return;
          if (summary.total > 0) {
            bar.textContent = formatReactionSummaryBar(summary);
            bar.classList.remove("hidden");
          } else {
            bar.classList.add("hidden");
          }
        });
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
      if (result.shared) {
        showToast("Shared.", "success");
      } else {
        showToast("Unshared.", "info");
      }
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
      console.log("Attempting to save post:", post.id);
      const result = await toggleSave(window.__firebaseApp, post.id);
      console.log("Save result:", result);
      saveBtn.textContent = result.saved ? "🔖 Saved" : "🔖 Save";
      showToast(result.saved ? "Post saved." : "Removed from saved.", "info");
    } catch (err) {
      console.error("Save error:", err);
      showToast(err.message || "Failed to save post", "error");
    }
  });

  flagBtn.addEventListener("click", () => flagPost(post.id));

  card.dataset.commentsReady = "1";
  return card;
}
