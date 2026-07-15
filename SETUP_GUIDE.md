# Free Textbook Library Setup Guide

This project is a static HTML, CSS, and JavaScript site with a Firebase backend. There is no build step.

## Project structure

- `index.html` contains the home page structure and copy.
- `catalog.html` contains the catalog and request-form structure and copy.
- `admin.html` contains the admin dashboard structure and copy.
- `css/variables.css` contains shared design tokens.
- `css/global.css` contains shared component styles.
- `css/pages/` contains page-specific styles.
- `js/firebase-config.js` initializes Firebase.
- `js/inventory.js` loads and filters books.
- `js/main.js` contains shared UI helpers.
- `data/seed-inventory.json` is the catalog fallback when Firestore is unavailable.

## Prerequisites

Install these tools before continuing:

- Node.js 18 or newer
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project with Authentication, Firestore, and Hosting enabled

## 1. Install dependencies

From the project directory, run:

```bash
npm install
```

## 2. Configure Firebase

1. Create or select a Firebase project.
2. Register a web app in Firebase Console.
3. Copy the web-app values into `js/firebase-config.js`.
4. Put the Firebase project ID in `.firebaserc`.
5. Enable Email/Password sign-in under Authentication.
6. Create a Firestore database.

The web-app configuration is designed to be included in browser code. Never place a Firebase Admin service-account private key in an HTML or JavaScript file.

## 3. Create the admin account and seed Firestore

The automated setup requires a Firebase Admin service-account file. Save it temporarily as `service-account.json`; Git ignores this file.

Run:

```bash
npm run setup
```

The script creates the admin account, imports the seed inventory, creates the admin permission document, and deploys the Firestore rules. Delete the local service-account file after setup if you no longer need it.

## 4. Test locally

ES modules and JSON requests need a local web server. Run:

```bash
npx serve .
```

Open the local URL printed by the command and verify:

1. The home page shows inventory totals and subject cards.
2. Catalog search, filters, and sorting work.
3. A student can submit a request.
4. The admin user can sign in.
5. The admin can add, edit, and delete a test book.

## 5. Deploy

Authenticate and deploy:

```bash
firebase login
firebase deploy
```

Firebase deploys Hosting and the Firestore security rules defined in `firebase.json`.

## Editing site content

Page copy now lives directly in the HTML:

- Edit home-page copy in `index.html`.
- Edit catalog copy and form labels in `catalog.html`.
- Edit dashboard copy in `admin.html`.
- Keep visual changes in the matching files under `css/`.
- Keep data loading and interactions in `js/`.

Navigation and footer markup is intentionally present in each HTML page. When changing shared navigation or contact details, update all three pages so they remain consistent.

## Updating books

Use the admin dashboard for normal inventory maintenance. Changes sync directly to the Firestore `books` collection. The public catalog reads from Firestore and uses `data/seed-inventory.json` only as a fallback.

## Changing the admin password

Open Firebase Console, go to Authentication, select `admin@freetextbooklibrary.local`, and reset the password. The password is not stored in this repository.

## Troubleshooting

### The catalog shows fallback books

- Confirm the Firebase values in `js/firebase-config.js` match your project.
- Confirm Firestore contains a `books` collection.
- Check the browser console for permission or network errors.
- Confirm the deployed `firestore.rules` allow public book reads.

### Requests fail

- Confirm Firestore contains or permits writes to the `requests` collection.
- Deploy the latest rules with `firebase deploy --only firestore:rules`.
- If Firestore is unavailable, the site opens a pre-filled email as a fallback.

### Admin login fails

- Confirm Email/Password authentication is enabled.
- Confirm the admin account uses `admin@freetextbooklibrary.local`.
- Confirm `/admins/{uid}` exists in Firestore and contains `isAdmin: true`.
- Reset the account password in Firebase Console if needed.
