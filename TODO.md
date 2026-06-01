# SnapVerse — roadmap

## Done (latest)
- [x] Facebook-style reactions (👍❤️😂😮😢😠)
- [x] Threaded comments panel with replies
- [x] Save posts + Saved page
- [x] Repost to feed with caption
- [x] Direct messages page
- [x] Public profiles (`?uid=`) with Follow + Message
- [x] Post audience: Public / Followers only
- [x] Follow notifications

## Deploy after pull
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy-firestore.ps1
```
(New indexes: conversations, posts by author, saves)

## Next
- [ ] Photo/video albums
- [ ] Groups or pages
- [ ] Live notifications (push)
- [ ] @mention → user UID notifications
- [ ] Reaction summary bar on posts
