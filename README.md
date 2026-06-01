# SnapVerse

A realtime social feed built with Firebase (Auth + Firestore), vanilla HTML/JS modules, and Tailwind CSS.

## Features

- Email/password auth
- Create posts with images, short videos, hashtags, and mentions
- Schedule posts for future publishing (auto-published every minute on the feed)
- Stories (24h) with fullscreen viewer and expired-story cleanup
- Likes, comments, shares with denormalized counts on post documents
- Notifications (filtered per user, unread badge, tap to open post)
- Feed modes: **All** and **Following**
- Post deep links (`/index.html?post=POST_ID`), copy link, social share
- Flag posts for moderation
- Admin dashboard (`mini-fb/admin.html`) gated by `admins/{uid}` in Firestore
- Dark mode, PWA manifest, service worker (offline shell)

## Quick start

1. Open the project folder with a static server (or deploy to Netlify/Vercel/Firebase Hosting).
2. Configure Firebase in `mini-fb/src/firebase-config.js`.
3. Open `/login.html`, create an account, then use `/index.html`.

For local development:

```bash
npx serve .
```

## Firestore index (required for notifications)

Create a composite index in the Firebase console:

- Collection: `notifications`
- Fields: `toUid` (Ascending), `createdAt` (Descending)

Or deploy `firestore.indexes.json` if you use the Firebase CLI.

## Admin setup

Create a document `admins/{your-user-uid}` in Firestore (any fields) to grant admin access.

## Project layout

```
index.html          — main feed
login.html          — auth
mini-fb/
  src/              — JS modules (feed, auth, ui, stories, …)
  admin.html        — moderation
  profile.html      — user profile
  search.html       — find users
  sw.js             — service worker
```

## Security

Client-side admin link hiding is not security. Enforce access with **Firestore Security Rules** so only admins can delete posts or read sensitive collections.

## License

© SnapVerse / Murray Shot
