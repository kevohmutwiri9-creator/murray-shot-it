/** Shared UI helpers: toasts, modals, character counters */

let toastRoot = null;

function ensureToastRoot() {
  if (toastRoot) return toastRoot;
  toastRoot = document.createElement("div");
  toastRoot.id = "toast-root";
  toastRoot.className = "fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none";
  toastRoot.setAttribute("aria-live", "polite");
  document.body.appendChild(toastRoot);
  return toastRoot;
}

export function showToast(message, type = "info", durationMs = 3200) {
  const root = ensureToastRoot();
  const el = document.createElement("div");
  const styles = {
    success: "bg-emerald-600 text-white",
    error: "bg-rose-600 text-white",
    info: "bg-gray-900 dark:bg-gray-700 text-white",
  };
  el.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${styles[type] || styles.info}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add("opacity-0", "transition", "duration-300");
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}

export function bindCharCounter(inputEl, counterEl, max) {
  if (!inputEl || !counterEl) return;
  const update = () => {
    const len = inputEl.value.length;
    counterEl.textContent = `${len}/${max}`;
    counterEl.classList.toggle("text-rose-500", len >= max);
    counterEl.classList.toggle("text-gray-500", len < max);
  };
  inputEl.addEventListener("input", update);
  update();
}

export function bindMediaPreview(fileEl, previewEl) {
  if (!fileEl || !previewEl) return;
  fileEl.addEventListener("change", () => {
    const file = fileEl.files?.[0];
    previewEl.innerHTML = "";
    previewEl.classList.add("hidden");
    if (!file) return;

    const url = URL.createObjectURL(file);
    previewEl.classList.remove("hidden");

    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.className = "w-full max-h-64 rounded-xl bg-black";
      previewEl.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Preview";
      img.className = "w-full max-h-64 object-cover rounded-xl";
      previewEl.appendChild(img);
    }
  });
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
  }
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
  }
}

/** Returns trimmed reason or null if cancelled */
export function promptFlagReason() {
  return new Promise((resolve) => {
    const existing = document.getElementById("flagReasonModal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "flagReasonModal";
    overlay.className = "fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4";
    overlay.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl" role="dialog" aria-labelledby="flagModalTitle">
        <h2 id="flagModalTitle" class="text-xl font-bold text-gray-900 dark:text-white mb-2">Flag this post</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Tell us why this content should be reviewed.</p>
        <textarea id="flagReasonInput" rows="3" maxlength="300" class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white resize-none outline-none focus:ring-2 focus:ring-accent/30" placeholder="Spam, harassment, etc."></textarea>
        <div class="flex gap-3 mt-4">
          <button type="button" id="flagSubmitBtn" class="flex-1 px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition">Submit</button>
          <button type="button" id="flagCancelBtn" class="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector("#flagReasonInput");
    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector("#flagSubmitBtn").addEventListener("click", () => {
      const reason = input.value.trim();
      if (!reason) {
        showToast("Please enter a reason.", "error");
        return;
      }
      finish(reason);
    });
    overlay.querySelector("#flagCancelBtn").addEventListener("click", () => finish(null));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(null);
    });
    input.focus();
  });
}

export function openStoryViewer(story) {
  const existing = document.getElementById("storyViewerModal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "storyViewerModal";
  overlay.className = "fixed inset-0 bg-black z-[9997] flex flex-col";
  const author = story.authorEmail?.split("@")[0] || "User";
  const expires = story.expiresAt?.toDate?.()
    ? story.expiresAt.toDate()
    : new Date(story.expiresAt);

  const profileLink = story.authorUid
    ? `/mini-fb/profile.html?uid=${encodeURIComponent(story.authorUid)}`
    : null;

  overlay.innerHTML = `
    <div class="flex items-center justify-between p-4 text-white gap-2">
      <div class="min-w-0">
        <p class="font-semibold">${author}</p>
        <p class="text-xs text-white/70">Expires ${expires.toLocaleString()}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${profileLink ? `<a href="${profileLink}" class="px-3 py-1.5 rounded-full bg-white/10 text-sm font-semibold hover:bg-white/20">Profile</a>` : ""}
        <button type="button" id="closeStoryViewer" class="p-2 rounded-full bg-white/10 hover:bg-white/20 transition" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="flex-1 flex items-center justify-center p-4 min-h-0" id="storyViewerMedia"></div>
  `;
  document.body.appendChild(overlay);

  const mediaWrap = overlay.querySelector("#storyViewerMedia");
  if (story.mediaType === "video") {
    const video = document.createElement("video");
    video.src = story.mediaUrl;
    video.controls = true;
    video.autoplay = true;
    video.className = "max-h-full max-w-full object-contain";
    mediaWrap.appendChild(video);
  } else if (story.mediaUrl) {
    const img = document.createElement("img");
    img.src = story.mediaUrl;
    img.alt = "Story";
    img.className = "max-h-full max-w-full object-contain";
    mediaWrap.appendChild(img);
  }

  const close = () => overlay.remove();
  overlay.querySelector("#closeStoryViewer").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target === mediaWrap) close();
  });
  document.addEventListener("keydown", function onEsc(ev) {
    if (ev.key === "Escape") {
      close();
      document.removeEventListener("keydown", onEsc);
    }
  });
}

export function showReactionPicker(anchorEl, onPick) {
  const existing = document.getElementById("reactionPicker");
  existing?.remove();

  const pop = document.createElement("div");
  pop.id = "reactionPicker";
  pop.className = "fixed z-[9999] flex gap-1 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 shadow-xl";
  pop.innerHTML = ["👍", "❤️", "😂", "😮", "😢", "😠"]
    .map((emoji, i) => {
      const ids = ["like", "love", "haha", "wow", "sad", "angry"];
      return `<button type="button" data-reaction="${ids[i]}" class="text-2xl hover:scale-125 transition p-1">${emoji}</button>`;
    })
    .join("");

  document.body.appendChild(pop);
  const rect = anchorEl.getBoundingClientRect();
  pop.style.left = `${Math.max(8, rect.left)}px`;
  pop.style.top = `${rect.top - 48}px`;

  const close = () => pop.remove();
  pop.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      onPick(btn.dataset.reaction);
      close();
    });
  });
  setTimeout(() => {
    document.addEventListener("click", function handler(e) {
      if (!pop.contains(e.target) && e.target !== anchorEl) {
        close();
        document.removeEventListener("click", handler);
      }
    });
  }, 0);
}

export function promptTextInput({ title, placeholder, maxLength = 200 }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4";
    overlay.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-3">${title}</h2>
        <textarea id="promptTextInput" rows="3" maxlength="${maxLength}" class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white resize-none" placeholder="${placeholder || ""}"></textarea>
        <div class="flex gap-3 mt-4">
          <button type="button" id="promptOk" class="flex-1 py-2 rounded-xl bg-accent text-white font-semibold">OK</button>
          <button type="button" id="promptCancel" class="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector("#promptTextInput");
    input.focus();
    overlay.querySelector("#promptOk").addEventListener("click", () => {
      resolve(input.value.trim());
      overlay.remove();
    });
    overlay.querySelector("#promptCancel").addEventListener("click", () => {
      resolve(null);
      overlay.remove();
    });
  });
}

export function initDarkMode(toggleId = "darkModeToggle") {
  const toggle = document.getElementById(toggleId);
  if (
    localStorage.getItem("darkMode") === "true" ||
    (!localStorage.getItem("darkMode") && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
  toggle?.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("darkMode", document.documentElement.classList.contains("dark"));
  });
}
