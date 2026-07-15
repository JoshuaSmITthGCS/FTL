# Firebase Setup Checklist

Use this checklist to complete the Firebase migration. Each step must be completed in order.

## ☐ Phase 1: Firebase Project Setup (15 minutes)

### ☐ 1.1 Create Firebase Project
- [ ] Go to https://console.firebase.google.com/
- [ ] Click "Add project"
- [ ] Name: "free-textbook-library" (or your choice)
- [ ] Disable Google Analytics (optional)
- [ ] Click "Create project"

### ☐ 1.2 Enable Firestore Database
- [ ] Build → Firestore Database
- [ ] Click "Create database"
- [ ] Select **Production mode**
- [ ] Location: **us-east1** (or closest)
- [ ] Click "Enable"

### ☐ 1.3 Enable Authentication
- [ ] Build → Authentication → Get started
- [ ] Sign-in method tab
- [ ] Enable **Email/Password**
- [ ] Save

### ☐ 1.4 Create Admin User
- [ ] Authentication → Users tab → Add user
- [ ] Email: `admin@freetextbooklibrary.local`
- [ ] Password: `admin` (or change to your preferred password)
- [ ] **Copy the User UID** (you'll need it in step 1.6)
- [ ] **Note:** Login form only shows password field; email is fixed internally

### ☐ 1.5 Update Project Configuration
- [ ] Open `.firebaserc` in your project
- [ ] Replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` with your project ID
- [ ] Find project ID: Firebase Console → Project Settings → Project ID

### ☐ 1.6 Create Admin Document in Firestore
- [ ] Firestore Database → Start collection
- [ ] Collection ID: `admins`
- [ ] Document ID: [Paste User UID from step 1.4]
- [ ] Add field: `isAdmin` (boolean) = `true`
- [ ] Click "Save"

### ☐ 1.7 Deploy Firestore Security Rules
```bash
cd /Users/eyerise/Downloads/free-textbook-library
firebase login
firebase deploy --only firestore:rules
```
- [ ] Rules deployed successfully

## ☐ Phase 2: Data Migration (10 minutes)

### ☐ 2.1 Download Service Account Key
- [ ] Project Settings (gear icon) → Service accounts
- [ ] Click "Generate new private key"
- [ ] Save as `service-account.json` in project root
- [ ] **DO NOT commit this file to git**

### ☐ 2.2 Install Dependencies
```bash
npm install
```
- [ ] Dependencies installed

### ☐ 2.3 Test Migration (Dry Run)
```bash
npm run migrate:dry
```
- [ ] Script completes without errors
- [ ] Shows 142 books will be migrated

### ☐ 2.4 Execute Migration
```bash
npm run migrate
```
- [ ] Migration completes successfully
- [ ] "Migration completed successfully!" message appears

### ☐ 2.5 Verify Migration
- [ ] Go to Firestore Database in Firebase Console
- [ ] Verify `/books` collection has 142 documents
- [ ] Verify `/metadata/stats` document exists
- [ ] Open a few book documents to check data

### ☐ 2.6 Delete Service Account Key
```bash
rm service-account.json
```
- [ ] File deleted (security best practice)

## ☐ Phase 3: Configure Web App (5 minutes)

### ☐ 3.1 Register Web App
- [ ] Project Settings → General → Your apps
- [ ] Click web icon `</>`
- [ ] App nickname: "Free Textbook Library"
- [ ] Don't check "Firebase Hosting"
- [ ] Click "Register app"

### ☐ 3.2 Copy Firebase Config
- [ ] Copy the `firebaseConfig` object shown
- [ ] Should look like:
```javascript
{
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123...",
  appId: "1:123..."
}
```

### ☐ 3.3 Update firebase-config.js
- [ ] Open `js/firebase-config.js`
- [ ] Replace the `firebaseConfig` object with your values
- [ ] Save the file

## ☐ Phase 4: Local Testing (10 minutes)

### ☐ 4.1 Start Local Server
```bash
python3 -m http.server 8000
```
- [ ] Server running at http://localhost:8000

### ☐ 4.2 Test Catalog Page
- [ ] Open http://localhost:8000/catalog.html
- [ ] Books load (check for 142 books or filtered count)
- [ ] Console shows: "✓ Loaded XX books from Firestore"
- [ ] Filter by subject works
- [ ] Search works
- [ ] Click a "Request" button
- [ ] Fill out form and submit
- [ ] Success toast appears

### ☐ 4.3 Verify Request in Firestore
- [ ] Go to Firebase Console → Firestore
- [ ] Open `/requests` collection
- [ ] Verify your test request appears

### ☐ 4.4 Test Admin Login
- [ ] Open http://localhost:8000/admin.html
- [ ] Enter admin email and password
- [ ] Should redirect to dashboard
- [ ] Stats show correct book counts
- [ ] Recent requests table shows your test request

### ☐ 4.5 Test Book Management
- [ ] Click "+ Add Book" button
- [ ] Fill in form:
  - Title: "Test Book"
  - Subject: "Math"
  - Status: "Available"
  - Quantity: 1
- [ ] Click "Save"
- [ ] Book appears in table
- [ ] Click "Edit" on test book
- [ ] Change title to "Test Book Updated"
- [ ] Click "Save"
- [ ] Title updates in table
- [ ] Click "Delete" on test book
- [ ] Confirm deletion
- [ ] Book removed from table

### ☐ 4.6 Test Logout
- [ ] Click "Sign out" button
- [ ] Redirects to login screen
- [ ] Refresh page - should stay on login screen

## ☐ Phase 5: Deploy to Production (5 minutes)

### ☐ 5.1 Deploy to Firebase Hosting
```bash
firebase deploy
```
- [ ] Deployment completes successfully
- [ ] Note the hosting URL (e.g., `your-project.web.app`)

### ☐ 5.2 Test Live Site
- [ ] Open the hosting URL in a browser
- [ ] Test catalog page (books load)
- [ ] Submit a request
- [ ] Login to admin (email + password)
- [ ] Verify dashboard works
- [ ] Test book management

### ☐ 5.3 Share Admin Credentials
- [ ] Share email and password with volunteers via secure channel
- [ ] **Recommended:** Use a password manager like 1Password or LastPass
- [ ] Document volunteer onboarding process

## ☐ Phase 6: Post-Deployment (Optional)

### ☐ 6.1 Archive Old Google Integrations
- [ ] Mark Google Sheet as "DEPRECATED - Using Firebase"
- [ ] Stop Google Form from accepting responses
- [ ] Keep for reference (don't delete yet)

### ☐ 6.2 Update Documentation
- [ ] Update README.md with new Firebase setup instructions
- [ ] Document admin workflow for volunteers
- [ ] Create quick reference guide for common tasks

### ☐ 6.3 Monitor Usage
- [ ] Check Firebase Console → Usage & billing
- [ ] Verify within free tier limits
- [ ] Set up budget alerts (optional)

## Troubleshooting

### "Firebase not configured" error
- Verify `js/firebase-config.js` has correct values (not placeholders)
- Check browser console for specific Firebase errors

### "Access denied" on admin login
- Verify admin UID in `/admins/{uid}` matches user from Authentication
- Check that `isAdmin` field is boolean `true`, not string "true"

### Books not loading
- Check Firestore rules are deployed: `firebase deploy --only firestore:rules`
- Verify migration completed (142 documents in `/books`)
- Check browser console for errors

### Migration fails
- Ensure `service-account.json` exists in project root
- Check JSON syntax is valid
- Verify Firestore is enabled in Firebase Console

## Need Help?

- **Firebase Docs**: https://firebase.google.com/docs
- **Migration Guide**: See MIGRATION_GUIDE.md
- **Implementation Details**: See IMPLEMENTATION_SUMMARY.md

---

**Estimated total time:** 45 minutes
**Difficulty:** Intermediate (requires Firebase account and basic terminal usage)
**Cost:** $0 (free tier sufficient)
