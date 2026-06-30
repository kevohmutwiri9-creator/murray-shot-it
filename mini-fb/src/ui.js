/**
 * Shared UI helpers: toasts, modals, character counters, skeletons
 */

let toastRoot = null;

/**
 * Ensure toast root element exists in DOM
 * @returns {HTMLElement} Toast root element
 */
function ensureToastRoot() {
  if (toastRoot) return toastRoot;
  toastRoot = document.createElement("div");
  toastRoot.id = "toast-root";
  toastRoot.className = "fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none";
  toastRoot.setAttribute("aria-live", "polite");
  document.body.appendChild(toastRoot);
  return toastRoot;
}

/**
 * Show toast notification
 * @param {string} message - Toast message content
 * @param {string} type - Toast type: 'success', 'error', or 'info'
 * @param {number} durationMs - Duration in milliseconds before auto-dismiss
 */
export function showToast(message, type = "info", durationMs = 3200) {
  const root = ensureToastRoot();
  const el = document.createElement("div");
  const styles = {
    success: "bg-emerald-600 text-white",
    error: "bg-rose-600 text-white",
    info: "bg-gray-900 dark:bg-gray-700 text-white",
  };
  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  };

  el.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm flex items-center gap-3 ${styles[type] || styles.info}`;
  el.innerHTML = `
    <span class="text-lg">${icons[type] || icons.info}</span>
    <span class="flex-1">${message}</span>
    <button class="opacity-70 hover:opacity-100 transition" aria-label="Dismiss">✕</button>
  `;
  root.appendChild(el);

  // Dismiss on button click
  const dismissBtn = el.querySelector("button");
  dismissBtn.addEventListener("click", () => {
    el.classList.add("opacity-0", "transition", "duration-300");
    setTimeout(() => el.remove(), 300);
  });

  // Auto dismiss after duration
  setTimeout(() => {
    if (el.isConnected) {
      el.classList.add("opacity-0", "transition", "duration-300");
      setTimeout(() => el.remove(), 300);
    }
  }, durationMs);
}

/**
 * Bind character counter to input element
 * @param {HTMLInputElement|HTMLTextAreaElement} inputEl - Input element to count
 * @param {HTMLElement} counterEl - Element to display count
 * @param {number} max - Maximum character count
 */
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

/**
 * Bind media preview to file input
 * @param {HTMLInputElement} fileEl - File input element
 * @param {HTMLElement} previewEl - Container element for preview
 */
export function bindMediaPreview(fileEl, previewEl) {
  if (!fileEl || !previewEl) return;
  
  fileEl.addEventListener("change", () => {
    const files = Array.from(fileEl.files || []);
    previewEl.innerHTML = "";
    previewEl.classList.add("hidden");
    
    if (!files.length) return;

    previewEl.classList.remove("hidden");
    
    // Create grid for multiple files
    const grid = document.createElement("div");
    grid.className = files.length > 1 ? "grid grid-cols-2 gap-2" : "";
    
    files.forEach((file, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "relative group";
      
      const url = URL.createObjectURL(file);
      
      if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = url;
        video.controls = true;
        video.className = "w-full max-h-64 rounded-xl bg-black object-cover";
        wrapper.appendChild(video);
      } else {
        const img = document.createElement("img");
        img.src = url;
        img.alt = `Preview ${index + 1}`;
        img.className = "w-full max-h-64 object-cover rounded-xl";
        wrapper.appendChild(img);
      }
      
      // Add remove button
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition";
      removeBtn.innerHTML = `
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      `;
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const newFiles = files.filter((_, i) => i !== index);
        const dataTransfer = new DataTransfer();
        newFiles.forEach(f => dataTransfer.items.add(f));
        fileEl.files = dataTransfer.files;
        fileEl.dispatchEvent(new Event("change"));
      });
      wrapper.appendChild(removeBtn);
      
      // Add file type indicator
      const typeBadge = document.createElement("div");
      typeBadge.className = "absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded-full";
      typeBadge.textContent = file.type.startsWith("video/") ? "🎬 Video" : "📷 Image";
      wrapper.appendChild(typeBadge);
      
      grid.appendChild(wrapper);
    });
    
    previewEl.appendChild(grid);
    
    // Add file count
    const countDiv = document.createElement("div");
    countDiv.className = "text-xs text-gray-500 dark:text-gray-400 mt-2";
    countDiv.textContent = `${files.length} file${files.length > 1 ? "s" : ""} selected`;
    previewEl.appendChild(countDiv);
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

// Skeleton loading components
export function createSkeletonCard() {
  const card = document.createElement("div");
  card.className = "bg-white/80 dark:bg-dark-surface/80 backdrop-blur-lg rounded-2xl shadow-medium border border-gray-200/50 dark:border-dark-border/50 p-5 animate-pulse";
  card.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
      <div class="flex-1 space-y-2">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
      </div>
    </div>
    <div class="space-y-3">
      <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
      <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
    </div>
  `;
  return card;
}

export function createSkeletonComment() {
  const comment = document.createElement("div");
  comment.className = "rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3 animate-pulse";
  comment.innerHTML = `
    <div class="flex items-center gap-2 mb-2">
      <div class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700"></div>
      <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
      <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
    </div>
    <div class="space-y-2">
      <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
    </div>
  `;
  return comment;
}

export function createSkeletonProfile() {
  const profile = document.createElement("div");
  profile.className = "animate-pulse";
  profile.innerHTML = `
    <div class="h-32 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-t-2xl"></div>
    <div class="p-6">
      <div class="flex items-center gap-4 -mt-12">
        <div class="w-24 h-24 rounded-2xl bg-gray-200 dark:bg-gray-700 border-4 border-white dark:border-gray-800"></div>
        <div class="flex-1 space-y-2">
          <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
      <div class="mt-6 space-y-3">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
      </div>
    </div>
  `;
  return profile;
}

export function createSkeletonMessage() {
  const message = document.createElement("div");
  message.className = "flex gap-3 p-3 animate-pulse";
  message.innerHTML = `
    <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
    <div class="flex-1 space-y-2">
      <div class="flex items-center gap-2">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
      </div>
      <div class="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
    </div>
  `;
  return message;
}

export function showLoadingState(container, count = 3, type = "card") {
  container.innerHTML = "";
  const skeletons = [];
  for (let i = 0; i < count; i++) {
    let skeleton;
    switch (type) {
      case "comment":
        skeleton = createSkeletonComment();
        break;
      case "profile":
        skeleton = createSkeletonProfile();
        break;
      case "message":
        skeleton = createSkeletonMessage();
        break;
      default:
        skeleton = createSkeletonCard();
    }
    skeletons.push(skeleton);
    container.appendChild(skeleton);
  }
  return skeletons;
}

export function hideLoadingState(container) {
  const skeletons = container.querySelectorAll(".animate-pulse");
  skeletons.forEach(s => s.remove());
}

// Form validation improvements
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePassword(password) {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return re.test(password);
}

export function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateUsername(username) {
  // Alphanumeric, underscores, hyphens, 3-20 characters
  const re = /^[a-zA-Z0-9_-]{3,20}$/;
  return re.test(username);
}

export function setFieldError(inputEl, message) {
  if (!inputEl) return;
  
  // Remove existing error
  clearFieldError(inputEl);
  
  // Add error styling
  inputEl.classList.add("border-rose-500", "focus:border-rose-500", "focus:ring-rose-500");
  inputEl.classList.remove("border-gray-200", "dark:border-gray-600", "focus:border-accent", "focus:ring-accent/30");
  
  // Add error message
  const errorEl = document.createElement("div");
  errorEl.className = "text-rose-500 text-xs mt-1 field-error";
  errorEl.textContent = message;
  inputEl.parentNode.appendChild(errorEl);
}

export function clearFieldError(inputEl) {
  if (!inputEl) return;
  
  // Remove error styling
  inputEl.classList.remove("border-rose-500", "focus:border-rose-500", "focus:ring-rose-500");
  inputEl.classList.add("border-gray-200", "dark:border-gray-600", "focus:border-accent", "focus:ring-accent/30");
  
  // Remove error message
  const errorEl = inputEl.parentNode.querySelector(".field-error");
  if (errorEl) errorEl.remove();
}

export function validateForm(formEl, rules) {
  const errors = [];
  
  for (const [fieldName, rule] of Object.entries(rules)) {
    const inputEl = formEl.querySelector(`[name="${fieldName}"]`) || 
                   formEl.querySelector(`#${fieldName}`);
    
    if (!inputEl) continue;
    
    const value = inputEl.value.trim();
    
    // Required validation
    if (rule.required && !value) {
      setFieldError(inputEl, rule.requiredMessage || `${fieldName} is required`);
      errors.push(fieldName);
      continue;
    }
    
    // Skip other validations if empty and not required
    if (!value && !rule.required) {
      clearFieldError(inputEl);
      continue;
    }
    
    // Email validation
    if (rule.email && !validateEmail(value)) {
      setFieldError(inputEl, rule.emailMessage || "Please enter a valid email address");
      errors.push(fieldName);
      continue;
    }
    
    // Password validation
    if (rule.password && !validatePassword(value)) {
      setFieldError(inputEl, rule.passwordMessage || "Password must be at least 8 characters with uppercase, lowercase, and number");
      errors.push(fieldName);
      continue;
    }
    
    // URL validation
    if (rule.url && !validateUrl(value)) {
      setFieldError(inputEl, rule.urlMessage || "Please enter a valid URL");
      errors.push(fieldName);
      continue;
    }
    
    // Username validation
    if (rule.username && !validateUsername(value)) {
      setFieldError(inputEl, rule.usernameMessage || "Username must be 3-20 characters (letters, numbers, underscores, hyphens)");
      errors.push(fieldName);
      continue;
    }
    
    // Min length validation
    if (rule.minLength && value.length < rule.minLength) {
      setFieldError(inputEl, rule.minLengthMessage || `Must be at least ${rule.minLength} characters`);
      errors.push(fieldName);
      continue;
    }
    
    // Max length validation
    if (rule.maxLength && value.length > rule.maxLength) {
      setFieldError(inputEl, rule.maxLengthMessage || `Must be no more than ${rule.maxLength} characters`);
      errors.push(fieldName);
      continue;
    }
    
    // Pattern validation
    if (rule.pattern && !rule.pattern.test(value)) {
      setFieldError(inputEl, rule.patternMessage || "Invalid format");
      errors.push(fieldName);
      continue;
    }
    
    // Custom validation
    if (rule.custom && !rule.custom(value)) {
      setFieldError(inputEl, rule.customMessage || "Invalid value");
      errors.push(fieldName);
      continue;
    }
    
    // Clear error if validation passes
    clearFieldError(inputEl);
  }
  
  return errors;
}

export function clearFormErrors(formEl) {
  if (!formEl) return;
  
  const inputs = formEl.querySelectorAll("input, textarea, select");
  inputs.forEach(input => clearFieldError(input));
}

export function bindFormValidation(formEl, rules, onSubmit) {
  if (!formEl) return;
  
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    clearFormErrors(formEl);
    
    // Validate form
    const errors = validateForm(formEl, rules);
    
    if (errors.length > 0) {
      // Focus on first error
      const firstErrorInput = formEl.querySelector(`[name="${errors[0]}"]`) ||
                            formEl.querySelector(`#${errors[0]}`);
      if (firstErrorInput) firstErrorInput.focus();
      return;
    }
    
    // Submit form if valid
    await onSubmit(formEl);
  });
  
  // Clear errors on input
  const inputs = formEl.querySelectorAll("input, textarea, select");
  inputs.forEach(input => {
    input.addEventListener("input", () => clearFieldError(input));
    input.addEventListener("blur", () => {
      if (input.value.trim()) {
        validateForm(formEl, rules);
      }
    });
  });
}

// Accessibility improvements
export function setAriaLabel(element, label) {
  if (!element) return;
  element.setAttribute("aria-label", label);
}

export function setAriaDescribedBy(element, describedById) {
  if (!element) return;
  element.setAttribute("aria-describedby", describedById);
}

export function setAriaExpanded(element, expanded) {
  if (!element) return;
  element.setAttribute("aria-expanded", String(expanded));
}

export function setAriaHidden(element, hidden) {
  if (!element) return;
  element.setAttribute("aria-hidden", String(hidden));
}

export function setRole(element, role) {
  if (!element) return;
  element.setAttribute("role", role);
}

export function trapFocus(container) {
  if (!container) return;
  
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleTab = (e) => {
    if (e.key !== "Tab") return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };
  
  container.addEventListener("keydown", handleTab);
  
  return () => container.removeEventListener("keydown", handleTab);
}

export function announceToScreenReader(message) {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", "polite");
  announcement.className = "sr-only absolute -left-[9999px]";
  announcement.textContent = message;
  document.body.appendChild(announcement);
  
  setTimeout(() => announcement.remove(), 1000);
}

export function manageFocusOnOpen(modal, triggerElement) {
  if (!modal) return;
  
  // Store the element that opened the modal
  modal.dataset.previousFocus = triggerElement?.id || "";
  
  // Focus on first focusable element
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  if (firstFocusable) {
    setTimeout(() => firstFocusable.focus(), 100);
  }
  
  // Trap focus within modal
  return trapFocus(modal);
}

export function restoreFocusOnClose(modal) {
  if (!modal) return;
  
  const previousFocusId = modal.dataset.previousFocus;
  if (previousFocusId) {
    const previousElement = document.getElementById(previousFocusId);
    if (previousElement) {
      previousElement.focus();
    }
  }
}

export function addKeyboardNavigation(container, options = {}) {
  if (!container) return;
  
  const {
    onEnter,
    onEscape,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onHome,
    onEnd,
  } = options;
  
  const handleKeyDown = (e) => {
    switch (e.key) {
      case "Enter":
        if (onEnter) {
          e.preventDefault();
          onEnter(e);
        }
        break;
      case "Escape":
        if (onEscape) {
          e.preventDefault();
          onEscape(e);
        }
        break;
      case "ArrowUp":
        if (onArrowUp) {
          e.preventDefault();
          onArrowUp(e);
        }
        break;
      case "ArrowDown":
        if (onArrowDown) {
          e.preventDefault();
          onArrowDown(e);
        }
        break;
      case "ArrowLeft":
        if (onArrowLeft) {
          e.preventDefault();
          onArrowLeft(e);
        }
        break;
      case "ArrowRight":
        if (onArrowRight) {
          e.preventDefault();
          onArrowRight(e);
        }
        break;
      case "Home":
        if (onHome) {
          e.preventDefault();
          onHome(e);
        }
        break;
      case "End":
        if (onEnd) {
          e.preventDefault();
          onEnd(e);
        }
        break;
    }
  };
  
  container.addEventListener("keydown", handleKeyDown);
  
  return () => container.removeEventListener("keydown", handleKeyDown);
}

export function setSkipLink() {
  // Check if skip link already exists
  if (document.getElementById("skip-link")) return;
  
  const skipLink = document.createElement("a");
  skipLink.id = "skip-link";
  skipLink.href = "#main-content";
  skipLink.className = "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[99999] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-xl focus:font-semibold";
  skipLink.textContent = "Skip to main content";
  
  document.body.insertBefore(skipLink, document.body.firstChild);
  
  // Ensure main content has id
  const mainContent = document.querySelector("main") || document.querySelector("[role='main']");
  if (mainContent && !mainContent.id) {
    mainContent.id = "main-content";
  }
}

export function reduceMotionPreference() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function setReducedMotion(element) {
  if (!element) return;
  
  if (reduceMotionPreference()) {
    element.style.animation = "none";
    element.style.transition = "none";
  }
}

export function addLiveRegion(element, politeness = "polite") {
  if (!element) return;
  
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", politeness);
}

export function updateLiveRegion(element, message) {
  if (!element) return;
  
  element.textContent = message;
  
  // Trigger screen reader to announce
  const previousContent = element.getAttribute("aria-live");
  element.setAttribute("aria-live", "off");
  setTimeout(() => {
    element.setAttribute("aria-live", previousContent || "polite");
  }, 100);
}

// Performance optimization utilities
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function memoize(fn) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

export function lazyLoadImages(container = document) {
  if (!('IntersectionObserver' in window)) {
    // Fallback for browsers without IntersectionObserver
    const images = container.querySelectorAll('img[data-src]');
    images.forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
    return;
  }
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '50px 0px',
    threshold: 0.01
  });
  
  const images = container.querySelectorAll('img[data-src]');
  images.forEach(img => imageObserver.observe(img));
  
  return imageObserver;
}

export function requestIdleCallback(callback, timeout = 2000) {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout });
  }
  // Fallback for browsers without requestIdleCallback
  return setTimeout(callback, 0);
}

export function cancelIdleCallback(handle) {
  if ('cancelIdleCallback' in window) {
    return window.cancelIdleCallback(handle);
  }
  clearTimeout(handle);
}

export function batchDOMUpdates(updates) {
  // Use requestAnimationFrame to batch DOM updates
  requestAnimationFrame(() => {
    document.body.style.display = 'none';
    try {
      updates.forEach(update => update());
    } finally {
      document.body.style.display = '';
    }
  });
}

export function virtualScroll(container, itemHeight, renderItem, totalItems) {
  const visibleItems = Math.ceil(container.clientHeight / itemHeight) + 5;
  const scrollTop = container.scrollTop;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleItems, totalItems);
  
  const fragment = document.createDocumentFragment();
  for (let i = startIndex; i < endIndex; i++) {
    const item = renderItem(i);
    item.style.position = 'absolute';
    item.style.top = `${i * itemHeight}px`;
    fragment.appendChild(item);
  }
  
  container.innerHTML = '';
  container.appendChild(fragment);
  container.style.height = `${totalItems * itemHeight}px`;
  
  return { startIndex, endIndex };
}

export function cacheImage(url) {
  if (!window.caches) return Promise.resolve();
  
  return caches.open('image-cache').then(cache => {
    return cache.match(url).then(response => {
      if (response) return response;
      return cache.add(url);
    });
  }).catch(() => {
    // Ignore cache errors
  });
}

export function prefetchResource(url) {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
}

export function preloadResource(url, as = 'script') {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = as;
  document.head.appendChild(link);
}

export function measurePerformance(name, fn) {
  if (!performance || !performance.mark) return fn();
  
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  const measureName = `${name}-measure`;
  
  performance.mark(startMark);
  const result = fn();
  performance.mark(endMark);
  performance.measure(measureName, startMark, endMark);
  
  return result;
}

export function getPerformanceMetrics() {
  if (!performance || !performance.getEntriesByType) return null;
  
  const navigation = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');
  
  return {
    domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
    loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
    firstPaint: paint?.find(p => p.name === 'first-paint')?.startTime,
    firstContentfulPaint: paint?.find(p => p.name === 'first-contentful-paint')?.startTime,
  };
}
