import { isPostVisible } from "./scheduled-posts.js";

export function canViewPost(post, viewerUid, followingSet) {
  if (!isPostVisible(post)) return false;
  const visibility = post.visibility || "public";
  if (visibility === "public") return true;
  if (visibility === "followers") {
    if (!viewerUid) return false;
    if (post.authorUid === viewerUid) return true;
    return followingSet?.has(post.authorUid);
  }
  return true;
}
