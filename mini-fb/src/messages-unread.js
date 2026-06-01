import { listenMyConversations } from "./messages.js";
import { getCurrentUser } from "./auth.js";

export function startMessagesBadge(db, badgeEl) {
  const user = getCurrentUser();
  if (!user || !badgeEl) return () => {};

  return listenMyConversations(db, (snap) => {
    let total = 0;
    snap.forEach((d) => {
      const data = d.data();
      const n = data.unreadCounts?.[user.uid];
      if (typeof n === "number" && n > 0) total += n;
    });
    badgeEl.textContent = total > 99 ? "99+" : String(total);
    badgeEl.classList.toggle("hidden", total === 0);
  });
}
