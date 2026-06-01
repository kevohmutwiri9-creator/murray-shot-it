import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { likeSubcol } from "./likes.js";
import { reactionEmoji } from "./reactions.js";

export async function getReactionSummary(db, postId) {
  const snap = await getDocs(likeSubcol(db, postId));
  const counts = {};
  snap.forEach((d) => {
    const r = d.data().reaction || "like";
    counts[r] = (counts[r] || 0) + 1;
  });
  return { counts, total: snap.size };
}

export function formatReactionSummaryBar(summary) {
  if (!summary?.total) return "";
  const emojis = Object.entries(summary.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => reactionEmoji(id))
    .join("");
  return `${emojis} ${summary.total}`;
}
