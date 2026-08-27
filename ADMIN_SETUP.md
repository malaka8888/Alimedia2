# Admin Console — Setup (read this once)

The old admin panel used a fake "client-side" login (a hardcoded email/password
checked in JavaScript, stored in `localStorage`). Anyone could read the source
and log in, or just set `localStorage.alimedia_admin_auth = 'true'` in the
browser console. That has been removed completely.

The new admin console uses **real Firebase Authentication**, and Firestore
security rules only allow writes (add/edit/delete elephants, events, etc.)
from accounts on an admin allowlist. You must do a **one-time setup** in the
Firebase Console before you can log in.

## 1. Create your admin login (Firebase Authentication)

1. Go to the [Firebase Console](https://console.firebase.google.com/) → your project.
2. **Authentication** → **Sign-in method** → make sure **Email/Password** is enabled.
3. **Authentication** → **Users** → **Add user**. Enter the email + password you
   want to use to log into the admin console, then save.
4. Copy the **User UID** shown next to the new user (looks like `aB3xY...`).

## 2. Add that account to the admin allowlist (Firestore)

1. Go to **Firestore Database** → **Data**.
2. Create a new collection named exactly `admins` (if it doesn't exist yet).
3. Inside it, create a document whose **Document ID** is the UID you copied
   in step 1 (any fields inside it are fine, e.g. `{ role: "owner" }`).
4. Save.

That's it. Any account with a matching document in `/admins/{uid}` can now
sign into the admin console (the shield icon in the top navbar) with their
email + password. Accounts *not* in `/admins` will be rejected even if the
email/password is correct.

## 3. Deploy the updated Firestore rules

The included `firestore.rules` file now enforces this at the database level
too (previously the database allowed **anyone** to write, which was a serious
security hole). Deploy it with the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

or paste its contents into **Firestore Database → Rules** in the console and
click **Publish**.

## Cloudinary

Cloudinary is now hardcoded in `src/firebase/cloudinaryService.ts`:

- Cloud name: `drmmn0xp3`
- Upload preset: `alimanagement`

There is no Cloudinary settings screen in the admin console anymore - if
these ever need to change, edit that file directly.

## What else changed in this pass

- **Admin panel rebuilt from scratch** with a clean sidebar layout: Dashboard,
  Elephants, Events, Posts, Users - each with full Create/Read/Update/Delete.
- Removed: the fake client-side login, the Cloudinary settings screen, the
  bulk Excel/CSV importer, and the diagnostics/database-export screen (all of
  which added surface area without being part of the core registry workflow).
- Elephant/event photo uploads still go straight to Cloudinary automatically
  from the edit form (compressed client-side first).
- Deleting an elephant still cascades: it removes the elephant's community
  posts, cleans it out of every user's followed list, and removes it from any
  event's participant list.
