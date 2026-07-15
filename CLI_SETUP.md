# 🚀 CLI Setup (Automated)

Set up everything via command line in 5 minutes.

## Prerequisites

1. **Node.js installed** (v18+)
2. **Firebase CLI installed:**
   ```bash
   npm install -g firebase-tools
   ```

## Steps

### 1. Create Firebase Project (Web Console - 2 min)

This is the **only** step you need to do in the web console:

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Project name: `free-textbook-library`
4. Disable Google Analytics (optional)
5. Click "Create project"
6. **Copy your project ID** (you'll need it in step 4)

### 2. Download Service Account Key (2 min)

1. In Firebase Console, click the gear icon → **Project Settings**
2. Go to **Service accounts** tab
3. Click "**Generate new private key**"
4. Click "**Generate key**"
5. Save the file as `service-account.json` in your project root:
   ```bash
   cd /Users/eyerise/Downloads/free-textbook-library
   # Move downloaded file here and rename to service-account.json
   ```

### 3. Login to Firebase CLI

```bash
firebase login
```

Follow the browser prompt to authenticate.

### 4. Run Automated Setup (1 min)

```bash
npm install
npm run setup
```

The script will ask for your Firebase project ID, then automatically:
- ✅ Update `.firebaserc` with your project ID
- ✅ Deploy Firestore security rules
- ✅ Create admin user (`admin@freetextbooklibrary.local` / `admin`)
- ✅ Set admin permissions in Firestore
- ✅ Migrate all 142 books to Firestore
- ✅ Create stats document

**That's it!** Setup is complete.

### 5. Get Firebase Web Config (1 min)

1. Go to Firebase Console → Project Settings
2. Scroll down to "Your apps"
3. Click the **Web icon** `</>`
4. App nickname: "Free Textbook Library"
5. Don't check "Firebase Hosting"
6. Click "Register app"
7. **Copy the `firebaseConfig` object**

### 6. Update firebase-config.js

Edit `js/firebase-config.js` and replace the config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",              // ← Paste your values here
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 7. Test Locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000/admin.html
- Password: `admin`
- Should see dashboard with 142 books

### 8. Deploy

```bash
firebase deploy
```

Done! Your site is live at `your-project.web.app`

## Clean Up

After successful deployment, delete the service account key:

```bash
rm service-account.json
```

## Login Credentials

**Admin login:**
- URL: `yoursite.web.app/admin.html`
- Password: `admin`

**To change password:**
```bash
firebase auth:export users.json
# Or use Firebase Console → Authentication → Users → Reset password
```

## What the CLI Script Does

```
┌─────────────────────────────────────────┐
│  npm run setup                          │
└─────────────────┬───────────────────────┘
                  │
                  ↓
    ┌─────────────────────────────┐
    │ 1. Update .firebaserc       │
    │ 2. Deploy Firestore rules   │
    │ 3. Create admin user        │
    │ 4. Set admin permissions    │
    │ 5. Migrate 142 books        │
    │ 6. Create stats             │
    └─────────────────────────────┘
                  │
                  ↓
         ✅ Setup Complete!
```

## Summary

**Total time:** ~5 minutes
**Manual steps:** 2 (create project, download key)
**Automated steps:** Everything else

**Commands:**
```bash
# One-time setup
firebase login
npm install
npm run setup

# Update config (manual edit)
# Edit js/firebase-config.js

# Test and deploy
python3 -m http.server 8000  # Test
firebase deploy              # Deploy
```

## Troubleshooting

**"service-account.json not found"**
→ Download from Firebase Console → Project Settings → Service Accounts

**"Permission denied"**
→ Run `firebase login` and make sure you're logged in

**"Project not found"**
→ Check project ID is correct (Firebase Console → Project Settings)

**"Admin user already exists"**
→ That's fine! Script will use existing user

## Need Help?

- Firebase CLI docs: https://firebase.google.com/docs/cli
- Full manual guide: `FIREBASE_SETUP_CHECKLIST.md`
- Detailed docs: `MIGRATION_GUIDE.md`
