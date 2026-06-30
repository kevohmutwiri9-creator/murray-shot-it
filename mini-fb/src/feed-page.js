import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { requireAuth, hideAdminNavIfNeeded, bootPage } from "./page-boot.js";
import { startFeed } from "./feed.js";
import { loadProfilesCache } from "./profiles-cache.js";
import { bindCreatePost } from "./admin.js";
import { publishDueScheduledPosts } from "./scheduled-posts.js";
import { startStories } from "./stories.js";
import { startNotifications, startMessageNotifications } from "./notifications.js";
import { bindCharCounter, bindMediaPreview, closeModal, showToast } from "./ui.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFriendSuggestions } from "./friend-suggestions.js";
import { profileUrl } from "./profiles-cache.js";
import { startReelsPreview } from "./reels.js";
import { searchProducts } from "./products.js";

export async function bootFeedPage(firebase) {
  try {
    // Don't require auth - allow public feed viewing
    const user = getCurrentUser();

    document.getElementById("auth-loading")?.classList.add("hidden");

    if (user) {
      await hideAdminNavIfNeeded(firebase, user);
    }

    bootPage(firebase);

    window.currentFirebaseUser = user;
    window.__firebaseApp = firebase;

    const db = getDbService(firebase);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/mini-fb/sw.js").catch(() => {});
  }

  // Publish due scheduled posts on load + interval
  const runScheduler = async () => {
    try {
      const n = await publishDueScheduledPosts(db);
      if (n > 0) showToast(`${n} scheduled post(s) published.`, "success");
    } catch {
      /* rules or offline */
    }
  };
  await runScheduler();
  setInterval(runScheduler, 60_000);

  // Feed filter: all | following
  const feedFilterAll = document.getElementById("feedFilterAll");
  const feedFilterFollowing = document.getElementById("feedFilterFollowing");
  let feedMode = localStorage.getItem("feedMode");
  if (feedMode !== "following") feedMode = "all";

  const styleFilterBtn = (btn, active) => {
    if (!btn) return;
    btn.className = active
      ? "px-3 py-1.5 text-sm font-semibold rounded-lg bg-accent text-white transition"
      : "px-3 py-1.5 text-sm font-semibold rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition";
  };

  const setFeedMode = (mode) => {
    feedMode = mode;
    localStorage.setItem("feedMode", mode);
    styleFilterBtn(feedFilterAll, mode === "all");
    styleFilterBtn(feedFilterFollowing, mode === "following");
    startFeed(firebase, { mode: feedMode, resetLimit: true });
  };

  feedFilterAll?.addEventListener("click", () => setFeedMode("all"));
  feedFilterFollowing?.addEventListener("click", () => setFeedMode("following"));

  await loadProfilesCache(db);
  setFeedMode(feedMode);

  // Hide skeleton when feed loads
  const feedSkeleton = document.getElementById("feedSkeleton");
  if (feedSkeleton) {
    feedSkeleton.classList.add("hidden");
  }

  bindCreatePost(firebase, {
    titleEl: document.getElementById("postTitle"),
    textEl: document.getElementById("postText"),
    fileEl: document.getElementById("postFile"),
    scheduleEl: document.getElementById("postSchedule"),
    visibilityEl: document.getElementById("postVisibility"),
    kindEl: document.getElementById("postKind"),
    formEl: document.getElementById("createPostForm"),
    btnEl: document.getElementById("createPostBtn"),
    statusEl: document.getElementById("createPostStatus"),
  });

  bindCharCounter(document.getElementById("postTitle"), document.getElementById("postTitleCount"), 80);
  bindCharCounter(document.getElementById("postText"), document.getElementById("postTextCount"), 140);
  bindMediaPreview(document.getElementById("postFile"), document.getElementById("postMediaPreview"));

  // Product tagging functionality
  const productSearch = document.getElementById("productSearch");
  const addProductBtn = document.getElementById("addProductBtn");
  const selectedProductsEl = document.getElementById("selectedProducts");
  let selectedProducts = [];

  if (productSearch && addProductBtn) {
    let searchTimeout;
    let searchResults = [];

    productSearch.addEventListener('input', async (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value;
      
      if (query.length < 2) {
        searchResults = [];
        return;
      }

      searchTimeout = setTimeout(async () => {
        try {
          const db = getDbService(firebase);
          searchResults = await searchProducts(db, query, null);
        } catch (err) {
          console.error('Error searching products:', err);
        }
      }, 300);
    });

    addProductBtn.addEventListener('click', async () => {
      if (searchResults.length === 0) {
        showToast('Search for a product first', 'error');
        return;
      }

      // Show product selection modal
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Select a Product</h3>
          <div class="space-y-3">
            ${searchResults.map(product => `
              <div class="product-option border border-gray-200 dark:border-gray-700 rounded-xl p-3 cursor-pointer hover:border-accent transition" data-product-id="${product.id}">
                <p class="font-semibold text-gray-900 dark:text-white">${product.name}</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">$${(product.price / 100).toFixed(2)}</p>
              </div>
            `).join('')}
          </div>
          <button id="closeProductModal" class="mt-4 w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Cancel</button>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelectorAll('.product-option').forEach(option => {
        option.addEventListener('click', () => {
          const productId = option.dataset.productId;
          const product = searchResults.find(p => p.id === productId);
          
          if (product && !selectedProducts.find(p => p.id === productId)) {
            selectedProducts.push(product);
            renderSelectedProducts();
            productSearch.value = '';
            searchResults = [];
          }
          
          modal.remove();
        });
      });

      document.getElementById('closeProductModal').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    });

    function renderSelectedProducts() {
      selectedProductsEl.innerHTML = selectedProducts.map(product => `
        <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">${product.name}</span>
          <button type="button" class="remove-product text-gray-500 hover:text-red-500 transition" data-product-id="${product.id}">×</button>
        </div>
      `).join('');

      selectedProductsEl.querySelectorAll('.remove-product').forEach(btn => {
        btn.addEventListener('click', () => {
          const productId = btn.dataset.productId;
          selectedProducts = selectedProducts.filter(p => p.id !== productId);
          renderSelectedProducts();
        });
      });
    }

    // Store selected products for use in post creation
    window.selectedProductsForPost = () => selectedProducts;
  }

  startNotifications(firebase, {
    listEl: document.getElementById("notificationsList"),
    badgeEl: document.getElementById("notificationBadge"),
    panelEl: document.getElementById("notificationsPanel"),
    btnEl: document.getElementById("notificationsBtn"),
  });

  startMessageNotifications(firebase, {});

  startStories(db, {
    containerEl: document.getElementById("storiesContainer"),
    addBtnEl: document.getElementById("addStoryBtn"),
  });
  startReelsPreview(db, document.getElementById("reelsPreview"));

  loadTrendingTopics(db);
  if (user) {
    loadFriendSuggestions(db, user.uid);
  }

  // Edit post modal
  const editPostModal = document.getElementById("editPostModal");
  const editPostForm = document.getElementById("editPostForm");
  document.getElementById("cancelEditBtn")?.addEventListener("click", () => closeModal("editPostModal"));

  document.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-id]");
    if (!editBtn) return;
    document.getElementById("editPostId").value = editBtn.dataset.editId;
    document.getElementById("editPostTitle").value = editBtn.dataset.editTitle;
    document.getElementById("editPostText").value = editBtn.dataset.editText;
    editPostModal?.classList.remove("hidden");
  });

  editPostForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const postId = document.getElementById("editPostId").value;
    const title = document.getElementById("editPostTitle").value.trim();
    const text = document.getElementById("editPostText").value.trim();

    try {
      await updateDoc(doc(db, "posts", postId), { title, text, updatedAt: new Date() });
      closeModal("editPostModal");
      showToast("Post updated.", "success");
    } catch (err) {
      showToast(err.message || "Update failed.", "error");
    }
  });
  } catch (error) {
    console.error("Error booting feed page:", error);
    document.getElementById("auth-loading")?.classList.add("hidden");
    // Only show toast for non-permission errors
    if (error.code !== 'permission-denied') {
      showToast("Failed to load feed. Please refresh the page.", "error");
    }
  }
}

async function loadTrendingTopics(db) {
  const container = document.getElementById("trendingTopics");
  if (!container) return;

  try {
    const hashtagsCol = collection(db, "hashtags");
    const snapshot = await getDocs(hashtagsCol);
    const trending = [];
    snapshot.forEach((docSnap) => trending.push({ id: docSnap.id, ...docSnap.data() }));
    trending.sort((a, b) => (b.count || 0) - (a.count || 0));
    const topTrending = trending.slice(0, 10);

    container.innerHTML = "";
    if (topTrending.length === 0) {
      container.innerHTML =
        '<span class="text-gray-500 dark:text-gray-400 text-sm">No trending topics yet</span>';
    } else {
      topTrending.forEach((hashtag) => {
        const tag = document.createElement("a");
        tag.href = `mini-fb/hashtag.html?tag=${encodeURIComponent(hashtag.id)}`;
        tag.className =
          "inline-flex items-center px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition";
        tag.textContent = `#${hashtag.id}`;
        container.appendChild(tag);
      });
    }
  } catch {
    container.innerHTML =
      '<span class="text-gray-500 dark:text-gray-400 text-sm">Trending unavailable</span>';
  }
}

async function loadFriendSuggestions(db, uid) {
  const container = document.getElementById("friendSuggestions");
  if (!container) return;
  try {
    const suggestions = await getFriendSuggestions(db, uid, 6);
    container.innerHTML = "";
    if (!suggestions.length) {
      container.innerHTML = '<p class="text-sm text-gray-500">Follow people to get suggestions.</p>';
      return;
    }
    suggestions.forEach((p) => {
      const a = document.createElement("a");
      a.href = profileUrl(p.uid);
      a.className =
        "flex items-center gap-2 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition";
      const label = p.displayName || p.email || "User";
      a.innerHTML = `<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent font-bold text-sm">${label.charAt(0).toUpperCase()}</span><span class="text-sm font-medium truncate">${label}</span>`;
      container.appendChild(a);
    });
  } catch {
    container.innerHTML = '<p class="text-sm text-gray-500">Suggestions unavailable</p>';
  }
}
