# Deploy Firebase (no CLI) — for Netlify: https://murray-shot-it.netlify.app/

Your site is already live on Netlify. Finish Firebase setup in the browser.

## 1. Authorized domains (required for login on Netlify)

1. Open [Firebase Console](https://console.firebase.google.com) → project **snapverse-32683**
2. **Build** → **Authentication** → **Settings** → **Authorized domains**
3. Click **Add domain** and add:
   - `murray-shot-it.netlify.app`
4. Save

Also keep `localhost` for local testing.

## 2. Firestore security rules

1. **Build** → **Firestore Database** → **Rules**
2. Replace everything with the contents of `firestore.rules` in this repo (copy from GitHub or your folder)
3. Click **Publish**

## 3. Notifications index (required for the bell)

1. **Build** → **Firestore Database** → **Indexes**
2. Click **Create index**
3. Set:
   - Collection ID: `notifications`
   - Field 1: `toUid` — Ascending
   - Field 2: `createdAt` — Descending
   - Query scope: Collection
4. Create and wait until status is **Enabled** (a few minutes)

Or open the app, trigger a notification error in the browser console — Firebase often shows a **link** to create the index automatically.

## 4. Admin user

1. **Firestore** → **Data** → start collection `admins`
2. Document ID: your Firebase Auth **User UID** (from Authentication → Users)
3. Any field (e.g. `role: "admin"`)

## 5. Test on Netlify

1. https://murray-shot-it.netlify.app/login.html — sign in or create account
2. Create a post on the feed
3. Open notifications (after index is enabled)

## Optional: install Firebase CLI later

Install [Node.js LTS](https://nodejs.org/) (includes npm), then in a **new** PowerShell window:

```powershell
npm install -g firebase-tools
firebase login
cd "c:\Coding\New folder (3)"
firebase use snapverse-32683
firebase deploy --only firestore
```
