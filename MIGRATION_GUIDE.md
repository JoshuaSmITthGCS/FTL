# Firebase Migration Guide

This guide walks you through migrating the Free Textbook Library from Google Sheets/Forms to Firebase.

## Prerequisites

- Firebase account (free tier is sufficient)
- Node.js installed (v18 or higher)
- Firebase CLI installed: `npm install -g firebase-tools`

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "free-textbook-library")
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Firestore Database

1. In Firebase Console, go to **Build** → **Firestore Database**
2. Click "Create database"
3. Choose **Production mode**
4. Select location: **us-east1** (or closest to your users)
5. Click "Enable"

## Step 3: Enable Authentication

1. In Firebase Console, go to **Build** → **Authentication**
2. Click "Get started"
3. Go to **Sign-in method** tab
4. Enable **Email/Password** provider
5. Click "Save"

## Step 4: Create Admin User

1. In Authentication section, go to **Users** tab
2. Click "Add user"
3. Email: `admin@freetextbooklibrary.local`
4. Password: `admin` (or set your preferred password)
5. Copy the **User UID** (you'll need this in Step 6)

**Note:** The admin login form only shows a password field. The email `admin@freetextbooklibrary.local` is used internally.

## Step 5: Deploy Firestore Security Rules

1. In your terminal, navigate to project directory:
   ```bash
   cd /path/to/free-textbook-library
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Update `.firebaserc` with your project ID:
   ```json
   {
     "projects": {
       "default": "your-project-id-here"
     }
   }
   ```

4. Deploy Firestore rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Step 6: Add Admin to Firestore

1. In Firebase Console, go to **Firestore Database**
2. Click "Start collection"
3. Collection ID: `admins`
4. Document ID: Paste the User UID from Step 4
5. Add field:
   - Field: `isAdmin`
   - Type: `boolean`
   - Value: `true`
6. Click "Save"

## Step 7: Download Service Account Key (for migration)

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Go to **Service accounts** tab
3. Click "Generate new private key"
4. Click "Generate key"
5. Save the downloaded JSON file as `service-account.json` in your project root
6. **IMPORTANT**: Never commit this file to git (it's in .gitignore)

## Step 8: Run Migration Script

1. Install dependencies:
   ```bash
   npm install
   ```

2. Test migration (dry run):
   ```bash
   npm run migrate:dry
   ```

3. Execute migration:
   ```bash
   npm run migrate
   ```

4. Verify in Firebase Console:
   - Go to Firestore Database
   - You should see `/books` collection with 142 documents
   - Check `/metadata/stats` document

## Step 9: Configure Web App

1. In Firebase Console, go to **Project Settings** → **General**
2. Scroll down to "Your apps"
3. Click the web icon `</>`
4. Register app:
   - App nickname: "Free Textbook Library"
   - Don't check "Firebase Hosting"
5. Copy the `firebaseConfig` object

6. Update `js/firebase-config.js`:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

## Step 10: Test Locally

1. Start a local server:
   ```bash
   python3 -m http.server 8000
   ```

2. Open browser: `http://localhost:8000`

3. Test catalog page:
   - Books should load from Firestore
   - Try filtering and searching
   - Submit a test request

4. Test admin page:
   - Login with admin credentials
   - Verify stats display
   - Try adding a book
   - Try editing a book
   - Try deleting a book
   - Check recent requests

## Step 11: Deploy to Firebase Hosting

1. Deploy everything:
   ```bash
   firebase deploy
   ```

2. Test live site (URL shown in terminal)

3. Share admin credentials with volunteers

## Step 12: Clean Up (Optional)

After successful migration:

1. Delete `service-account.json`:
   ```bash
   rm service-account.json
   ```

2. Archive old Google Sheets/Forms (don't delete yet)

## Verification Checklist

- [ ] Firestore has 142 books in `/books` collection
- [ ] Admin user exists in Authentication
- [ ] Admin document exists in `/admins/{uid}` with `isAdmin: true`
- [ ] Security rules deployed
- [ ] Catalog page loads books from Firestore
- [ ] Request submission works
- [ ] Admin login works
- [ ] Book management (add/edit/delete) works
- [ ] Recent requests display in admin dashboard
- [ ] Site deployed to Firebase Hosting

## Troubleshooting

### "Firebase not configured" error
- Check that `js/firebase-config.js` has correct config values
- Verify config object is NOT commented out

### "Access denied" on admin login
- Verify admin user UID matches document ID in `/admins` collection
- Check that `isAdmin` field is `true` (boolean, not string)

### Books not loading
- Check browser console for errors
- Verify Firestore rules are deployed
- Check that migration script completed successfully

### Request submission fails
- Check Firestore rules allow public writes to `/requests`
- Verify browser console for specific error

### Migration script fails
- Ensure `service-account.json` exists in project root
- Check that JSON is valid (no extra commas)
- Verify you have Firestore enabled in Firebase Console

## Cost

All Firebase services used (Firestore, Authentication, Hosting) fall within free tier limits:

- **Firestore**: 50K reads/day, 20K writes/day (free)
- **Authentication**: Unlimited users (free)
- **Hosting**: 10GB storage, 360MB/day bandwidth (free)

Expected cost: **$0/month** for typical library usage.

## Support

- Firebase Documentation: https://firebase.google.com/docs
- Firestore Security Rules: https://firebase.google.com/docs/firestore/security/get-started
- Firebase Authentication: https://firebase.google.com/docs/auth
