/* ============================================================
   firebase-config.js
   Firebase configuration for Free Textbook Library

   After Firebase migration:
     - Books stored in Firestore /books collection
     - Requests stored in Firestore /requests collection
     - Admin authentication via Firebase Auth

   To configure: Replace values below with your Firebase project config
   Get config from: Firebase Console → Project Settings → Web App
   ============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export const firebaseConfig = {
  apiKey: "AIzaSyAq9fp6GOI3jCH7Umm3eJsfSFKaLtvxwdM",
  authDomain: "freetextlibrary.firebaseapp.com",
  projectId: "freetextlibrary",
  storageBucket: "freetextlibrary.firebasestorage.app",
  messagingSenderId: "929997338751",
  appId: "1:929997338751:web:ba9fcf77f2d7ece27b274a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const firebaseProjectId = firebaseConfig.projectId;
