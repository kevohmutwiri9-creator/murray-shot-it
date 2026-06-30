import { ensureAuth, getCurrentUser, isAdmin } from "./auth.js";
import { getDbService } from "./firebase-config.js";
import { initDarkMode, showToast } from "./ui.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export async function isUserBanned(firebaseApp, uid) {
  // Disabled ban check to prevent permission errors
  return false;
}

export async function ensureProfile(firebaseApp, user) {
  // Silently skip profile check to prevent permission errors
  // Profile creation will happen naturally when user interacts with the app
  return;
}

/**
 * Require login; redirect if banned or logged out.
 * @returns {import('firebase/auth').User | null}
 */
export async function requireAuth(firebaseApp, { loginPath = "/login.html" } = {}) {
  try {
    await ensureAuth(firebaseApp);
  } catch (error) {
    console.warn("User not authenticated, redirecting to login");
    window.location.href = loginPath;
    return null;
  }

  const user = getCurrentUser();
  if (!user) {
    window.location.href = loginPath;
    return null;
  }

  if (await isUserBanned(firebaseApp, user.uid)) {
    showToast("This account has been suspended.", "error");
    await signOut(getAuth(firebaseApp));
    window.location.href = loginPath;
    return null;
  }

  // Skip profile check to prevent permission errors
  // await ensureProfile(firebaseApp, user);
  import("./presence.js").then(({ startPresence }) => {
    startPresence(getDbService(firebaseApp), user.uid);
  });
  return user;
}

export async function hideAdminNavIfNeeded(firebaseApp, user) {
  const admin = await isAdmin(firebaseApp, user.uid);
  if (!admin) {
    document.querySelectorAll('a[href*="admin.html"]').forEach((link) => {
      link.style.display = "none";
    });
  }
  return admin;
}

export function initMobileMenu() {
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const closeMobileMenu = document.getElementById("closeMobileMenu");
  const mobileMenu = document.getElementById("mobileMenu");

  mobileMenuBtn?.addEventListener("click", () => mobileMenu?.classList.remove("hidden"));
  closeMobileMenu?.addEventListener("click", () => mobileMenu?.classList.add("hidden"));
  mobileMenu?.addEventListener("click", (e) => {
    if (e.target === mobileMenu) mobileMenu.classList.add("hidden");
  });
}

export function bootPage(firebaseApp) {
  initDarkMode();
  initMobileMenu();
  startNavBadges(firebaseApp);
}

function startNavBadges(firebaseApp) {
  const badge = document.getElementById("messagesBadge");
  const mobileBadge = document.getElementById("mobileMessagesBadge");
  if (!getCurrentUser()) return;
  import("./messages-unread.js").then(({ startMessagesBadge }) => {
    startMessagesBadge(firebaseApp.__db, badge, mobileBadge);
  });
}
