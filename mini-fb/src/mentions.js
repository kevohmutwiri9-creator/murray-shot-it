import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { profileUrlForHandle } from "./profiles-cache.js";

export function extractMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1].toLowerCase());
  }
  return [...new Set(mentions)];
}

export function formatTextWithMentions(text) {
  return text.replace(/@(\w+)/g, (_, handle) => {
    const href = profileUrlForHandle(handle);
    return `<a href="${href}" class="text-accent hover:underline font-medium">@${handle}</a>`;
  });
}

export async function saveMentions(db, postId, mentions) {
  if (mentions.length === 0) return;

  const batch = [];
  mentions.forEach((username) => {
    const mentionRef = doc(db, "mentions", username);
    batch.push(
      getDoc(mentionRef).then((snap) => {
        const data = snap.exists() ? snap.data() : { postIds: [], count: 0 };
        if (!data.postIds.includes(postId)) {
          data.postIds.push(postId);
          data.count = data.postIds.length;
          return setDoc(mentionRef, data, { merge: true });
        }
      })
    );
  });

  await Promise.all(batch);
}
