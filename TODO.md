# TODO - SnapVerse fixes

- [x] Fix `sw.js` caching errors (ignore unsupported schemes/methods; never cache non-GET; guard cache.put)
- [ ] Verify service worker no longer throws `chrome-extension` / `POST` cache.put errors

- [ ] Identify remaining Firestore “Missing or insufficient permissions” source (log which call/collection)
- [ ] Patch Firestore security rules only for the failing paths (avoid broad relaxations)
- [ ] Re-test main load flow: index.html + mini-fb pages