# ⚡ START HERE - 5 Minute Setup

Everything is automated via CLI. Just follow these steps:

## Step 1: Create Firebase Project (Web - 2 min)

1. Go to https://console.firebase.google.com/
2. Click "**Add project**"
3. Name: `free-textbook-library`
4. Click through and create
5. **Copy the project ID** (you'll need it)

## Step 2: Download Service Account (Web - 1 min)

1. In Firebase Console → **Project Settings** (gear icon)
2. **Service accounts** tab
3. Click "**Generate new private key**"
4. Save as `service-account.json` in this folder

## Step 3: Run Setup Script (CLI - 2 min)

```bash
./setup.sh
```

It will ask for your project ID, then automatically:
- ✅ Login to Firebase
- ✅ Install dependencies
- ✅ Deploy security rules
- ✅ Create admin user (password: `admin`)
- ✅ Migrate 142 books to Firestore

## Step 4: Get Web Config (Web - 1 min)

1. Firebase Console → **Project Settings**
2. Scroll to "Your apps" → Click **Web icon** `</>`
3. Register app (name: "Free Textbook Library")
4. **Copy the `firebaseConfig` object**

Paste into `js/firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "...",           // ← Your values here
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## Step 5: Deploy

```bash
firebase deploy
```

## Done! 🎉

Your site is live at: `your-project.web.app`

**Admin login:**
- URL: `/admin.html`
- Password: `admin`

---

## Commands Summary

```bash
# One-time setup (run once)
./setup.sh

# Edit config (after getting web config from console)
# Edit: js/firebase-config.js

# Deploy
firebase deploy

# Test locally first (optional)
python3 -m http.server 8000
# Visit: http://localhost:8000/admin.html
# Password: admin
```

---

## What Just Happened?

The `setup.sh` script automated everything:

```
Created in Firebase:
├── 📁 Firestore
│   ├── /books (142 documents)
│   ├── /admins (admin permissions)
│   └── /metadata (stats)
├── 🔐 Authentication
│   └── admin@freetextbooklibrary.local (password: admin)
└── 🛡️ Security Rules
    └── Deployed
```

---

## Change Admin Password

**Option 1: Firebase Console**
1. Authentication → Users
2. Find `admin@freetextbooklibrary.local`
3. Click menu (⋮) → Reset password

**Option 2: CLI**
```bash
firebase auth:export users.json
# Edit users.json, change password
firebase auth:import users.json
```

---

## Troubleshooting

**"Firebase CLI not found"**
```bash
npm install -g firebase-tools
```

**"service-account.json not found"**
- Download from Firebase Console → Project Settings → Service Accounts

**"Permission denied on setup.sh"**
```bash
chmod +x setup.sh
```

**Need help?**
- Quick: `CLI_SETUP.md`
- Detailed: `MIGRATION_GUIDE.md`
- Manual: `FIREBASE_SETUP_CHECKLIST.md`

---

**Total time:** ~5 minutes
**Manual steps:** 2 (create project, get config)
**Automated:** Everything else
