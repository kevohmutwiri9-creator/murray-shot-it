// Hashtag utilities for SnapVerse
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function extractHashtags(text) {
  const hashtagRegex = /#(\w+)/g;
  const hashtags = [];
  let match;
  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }
  return [...new Set(hashtags)]; // Remove duplicates
}

export function formatTextWithHashtags(text) {
  return text.replace(/#(\w+)/g, '<a href="hashtag.html?tag=$1" class="text-accent hover:underline font-medium">#$1</a>');
}

export async function saveHashtags(db, postId, hashtags) {
  if (hashtags.length === 0) return;

  const batch = [];
  hashtags.forEach((tag) => {
    const hashtagRef = doc(db, "hashtags", tag);
    batch.push(
      getDoc(hashtagRef).then((snap) => {
        const data = snap.exists() ? snap.data() : { postIds: [], count: 0 };
        if (!data.postIds.includes(postId)) {
          data.postIds.push(postId);
          data.count = data.postIds.length;
          return setDoc(hashtagRef, data, { merge: true });
        }
      })
    );
  });

  await Promise.all(batch);
}
