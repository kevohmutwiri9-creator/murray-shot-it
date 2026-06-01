# SnapVerse — roadmap

## Done
- [x] Reactions, threaded comments, saves, reposts, DMs, profiles, follow
- [x] @mention notifications
- [x] Reaction summary bar on posts
- [x] Unread messages badge + read receipts
- [x] Block/mute users + feed filtering
- [x] Firestore feed pagination (load more)
- [x] Explore page + friend suggestions
- [x] Search recent terms
- [x] Profile delete post, multi-photo albums (up to 5)
- [x] Rate limits (post/comment/message)
- [x] Report user + admin pending counts
- [x] Group chats, images in DMs, share post to DM
- [x] Push notification preference (FCM scaffold in Settings)
- [x] Offline app-shell caching (service worker v3)

## Deploy after pull
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy-firestore.ps1
```
New index: `posts` → `likeCount` desc (Explore popular posts)

## Optional next
- [ ] Full Firebase Cloud Messaging (server key + `firebase-messaging-sw.js`)
- [ ] Netlify function to hide ImgBB API key
- [ ] Firebase Storage for large videos
