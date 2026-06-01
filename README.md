# SnapVerse

A realtime social feed built with Firebase (Auth + Firestore), vanilla HTML/JS modules, and Tailwind CSS.

## Features

- Email/password auth with auto-created profiles
- Posts (images, short video, hashtags, mentions, scheduling)
- Stories (24h viewer, auto-cleanup)
- Likes, comments, shares with denormalized counts
- Notifications (per-user query, unread badge, deep links)
- Feed: **All** / **Following**
- Admin dashboard, flags, user bans
- Dark mode, PWA manifest, service worker

## Quick start (local)

```bash
npx serve .
```

Open `http://localhost:3000/login.html`, create an account, then use `/index.html`.

## Deploy to GitHub Pages

1. Push to `main` — the workflow in `.github/workflows/pages.yml` deploys automatically.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. After deploy, your site URL is shown under **Settings → Pages** (e.g. `https://kevohmutwiri9-creator.github.io/murray-shot-it/`).

### Firebase after Pages deploy

In [Firebase Console](https://console.firebase.google.com) → **Authentication → Settings → Authorized domains**, add:

- `kevohmutwiri9-creator.github.io` (or your Pages hostname)

## Deploy Firestore rules & indexes

Install [Firebase CLI](https://firebase.google.com/docs/cli), then:

```bash
firebase login
firebase use snapverse-32683
firebase deploy --only firestore
```

This applies `firestore.rules` and `firestore.indexes.json`.

### Admin access

Create document `admins/{your-uid}` in Firestore (any fields).

## Deploy to Firebase Hosting (alternative)

```bash
firebase deploy --only hosting
```

Uses `firebase.json` — serves the repo root as static files.

## Project layout

```
index.html              — main feed
login.html              — auth
firestore.rules         — security rules
firestore.indexes.json  — composite indexes
firebase.json           — hosting + firestore config
mini-fb/src/            — JS modules
```

## Security notes

- Rules in `firestore.rules` enforce auth, bans, admin-only moderation, and per-user notifications.
- Client-side admin link hiding is **not** security — rules are required.
- Rotate ImgBB API key if exposed; consider a backend proxy for uploads in production.

## License

© SnapVerse / Murray Shot
