# TODO - Firebase “mini-FB” (Murray Shot)

## Step 1: Scaffold the app
- [ ] Create folder `mini-fb/`
- [ ] Add core static HTML pages:
  - [ ] `mini-fb/index.html` (feed + create post)
  - [ ] `mini-fb/login.html` (email/password login + logout)
  - [ ] `mini-fb/admin.html` (admin dashboard)

## Step 2: Add JS modules
- [ ] Add `mini-fb/src/firebase-config.js` (placeholder for your Firebase config)
- [ ] Add `mini-fb/src/auth.js` (email/password auth + user handling)
- [ ] Add `mini-fb/src/feed.js` (Firestore real-time feed)
- [ ] Add `mini-fb/src/admin.js` (admin gating via `admins/{uid}` + CRUD)

## Step 3: Add shared UI/UX
- [ ] Add consistent styling (Tailwind via CDN)
- [ ] Validate forms (title/text/media upload)
- [ ] Show loading + error states

## Step 4: Firestore + Storage data model & rules
- [ ] Document Firestore schema in `mini-fb/README.md`
- [ ] Document Storage upload path in `mini-fb/README.md`
- [ ] Provide Firestore Security Rules (admins/{uid} gating + public feed)

## Step 5: Testing checklist (manual)
- [ ] Verify login/logout
- [ ] Verify non-admin users can’t access admin page
- [ ] Verify admin can create/delete posts
- [ ] Verify media upload works and displays in feed
- [ ] Verify real-time updates across users
