# 🚀 Quick Start Guide - Simplified Setup

The admin login has been simplified to use just a password (like the original design).

## Admin Login

### What You See
```
┌─────────────────────────┐
│    Admin Login          │
│                         │
│  Password: [________]   │
│                         │
│      [Sign in]          │
└─────────────────────────┘
```

### What Happens Behind the Scenes
- Fixed email: `admin@freetextbooklibrary.local`
- Your password: `admin` (default) or whatever you set
- Firebase Auth handles security automatically

## Setup Steps (Simplified)

### 1. Create Firebase Project
- Go to https://console.firebase.google.com/
- Create new project: "free-textbook-library"

### 2. Enable Services
- Enable **Firestore Database** (production mode)
- Enable **Authentication** (Email/Password)

### 3. Create Admin User
- Authentication → Users → Add user
- Email: `admin@freetextbooklibrary.local`
- Password: `admin`
- Copy the User UID

### 4. Set Admin Permissions
- Firestore → Start collection: `admins`
- Document ID: [paste User UID]
- Field: `isAdmin` (boolean) = `true`

### 5. Get Firebase Config
- Project Settings → Your apps → Web
- Copy the config object

### 6. Update Code
**File: `js/firebase-config.js`**
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

**File: `.firebaserc`**
```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

### 7. Deploy Rules
```bash
firebase login
firebase deploy --only firestore:rules
```

### 8. Migrate Data
```bash
npm install
npm run migrate
```

### 9. Deploy Site
```bash
firebase deploy
```

## Login Credentials

**Default:**
- Password: `admin`

**To change password:**
1. Go to Firebase Console → Authentication
2. Find user: `admin@freetextbooklibrary.local`
3. Click the menu (⋮) → Reset password
4. Or delete and recreate with new password

**To share with volunteers:**
- Just share the password: `admin`
- They go to: `yoursite.web.app/admin.html`
- Enter password and click "Sign in"

## That's It!

The simplified setup:
- ✅ Just password (no email required at login)
- ✅ Fixed email used internally
- ✅ Full Firebase Auth security
- ✅ Same workflow as original design

---

**Full documentation:** See `FIREBASE_SETUP_CHECKLIST.md` for complete step-by-step guide.
