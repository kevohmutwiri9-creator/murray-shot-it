import { ensureAuth, getCurrentUser, isAdmin } from "./auth.js";
import { getDbService } from "./firebase-config.js";
import { initDarkMode, showToast } from "./ui.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export async function isUserBanned(firebaseApp, uid) {
  const db = getDbService(firebaseApp);
  const snap = await getDoc(doc(db, "banned", uid));
  return snap.exists();
}

export async function ensureProfile(firebaseApp, user) {
  const db = getDbService(firebaseApp);
  const ref = doc(db, "profiles", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    uid: user.uid,
    email: user.email || null,
    displayName: user.email?.split("@")[0] || "User",
    bio: "",
    createdAt: serverTimestamp(),
  });
}

/**
 * Require login; redirect if banned or logged out.
 * @returns {import('firebase/auth').User | null}
 */
export async function requireAuth(firebaseApp, { loginPath = "/login.html" } = {}) {
  await ensureAuth(firebaseApp).catch(() => {});

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

  await ensureProfile(firebaseApp, user);
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
  if (!badge || !getCurrentUser()) return;
  import("./messages-unread.js").then(({ startMessagesBadge }) => {
    startMessagesBadge(firebaseApp.__db, badge);
  });
}
