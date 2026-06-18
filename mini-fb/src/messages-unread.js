import { listenMyConversations } from "./messages.js";
import { getCurrentUser } from "./auth.js";

export function startMessagesBadge(db, badgeEl, mobileBadgeEl) {
  const user = getCurrentUser();
  if (!user || (!badgeEl && !mobileBadgeEl)) return () => {};

  return listenMyConversations(db, (snap) => {
    let total = 0;
    snap.forEach((d) => {
      const data = d.data();
      const n = data.unreadCounts?.[user.uid];
      if (typeof n === "number" && n > 0) total += n;
    });
    const value = total > 99 ? "99+" : String(total);
    if (badgeEl) {
      badgeEl.textContent = value;
      badgeEl.classList.toggle("hidden", total === 0);
    }
    if (mobileBadgeEl) {
      mobileBadgeEl.textContent = value;
      mobileBadgeEl.classList.toggle("hidden", total === 0);
    }
  });
}
