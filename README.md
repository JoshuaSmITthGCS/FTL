# Free Textbook Library

A volunteer-friendly inventory management site for the College of Charleston's Free Textbook Library. Built with Vite + React and a Firebase backend (Firestore, Auth, Hosting).

> **If you're a library volunteer, don't start here — read `SETUP_GUIDE.md` instead.** This README is for developers.

---

## Architecture

A Vite + React single-page app (React Router) backed by Firebase:

- `src/pages/` holds the three routes: Home (`/`), Catalog (`/catalog`), Admin (`/admin`, lazy-loaded).
- `src/lib/` holds the Firebase client, inventory helpers, and the barcode scanner.
- Shared design tokens and components live in `src/styles/css/`.
- Firestore stores the live catalog and student requests.
- Firebase Authentication protects the admin dashboard.
- `public/data/seed-inventory.json` provides a local fallback catalog.

## File structure

```
free-textbook-library/
├── index.html              Vite entry (mounts #root)
├── vite.config.js
├── firebase.json           Firebase Hosting config (serves dist/, SPA rewrite)
├── firestore.rules
├── functions/              Cloud Function that emails new requests
├── scripts/                Firebase setup + migration scripts
├── public/data/            seed-inventory.json (fallback catalog)
└── src/
    ├── main.jsx            Router + providers
    ├── App.jsx             Routes, page titles
    ├── components/         Layout (nav/footer), Toast
    ├── pages/
    │   ├── HomePage.jsx
    │   ├── CatalogPage.jsx     Filters, sorting, request modal
    │   ├── AdminPage.jsx       Dashboard: inventory, requests, checkout, bulk scan
    │   └── admin/              Login, book modal, checkout modal, helpers
    ├── lib/
    │   ├── firebase.js         Firebase client configuration
    │   ├── inventory.js        Inventory fetch/filter/sort helpers
    │   ├── useInventory.js     React hook for the public catalog
    │   └── barcode-scanner.js  Camera ISBN scanner + ISBN helpers
    └── styles/css/             variables.css, reset.css, global.css, pages/*.css
```

## Key architectural decisions

**Content in components.** Each page's copy lives directly in its JSX file, so content edits do not require tracing data through a separate JSON layer.

**Firestore with a local fallback.** `src/lib/inventory.js` reads the live `books` collection from Firestore. If Firebase is unavailable, it falls back to `seed-inventory.json`, so the public catalog can still render.

**Requests in Firestore.** The catalog writes student requests to the `requests` collection. If Firebase is unavailable, it falls back to a pre-filled email.

**Permanent copy-given flow.** Admins mark a pending request “copy given” to decrement the matching book's available quantity. Given copies are not expected back. Inventory displays available and all recorded copies as a fraction, such as `2 / 5`, while completed requests form a permanent “Copies given” history. Firestore transactions keep the request and inventory changes in sync.

**Edition and usage reporting.** Edition is stored on each book and shown to students in the catalog and request confirmation. The admin dashboard ranks copies given by subject and exports a spreadsheet-ready CSV with both a subject summary and request-level details.

**Firebase admin authentication.** The admin form signs in through Firebase Authentication, then verifies the user's matching Firestore admin document before showing the dashboard.

## Design tokens

All design decisions live in `src/styles/css/variables.css`:

- **Primary**: `#1f3a2e` (forest green)
- **Accent**: `#c25a3e` (terracotta)
- **Paper**: `#faf6ef` (warm off-white)
- **Display font**: Fraunces (variable weight + optical size)
- **Body font**: Inter Tight

## Local development

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production bundle in dist/
npm run preview   # serve the built bundle
```

## Deployment

```bash
npm install -g firebase-tools
firebase login
firebase deploy   # runs `npm run build` first (hosting predeploy), then serves dist/
```

Full setup instructions for non-developers are in `SETUP_GUIDE.md`.

## Extending

**Add a new page:**
1. Create `src/pages/NewPage.jsx`
2. Add a `<Route>` in `src/App.jsx` (and a title in `TITLES`)
3. Add the link in `src/components/Layout.jsx`
4. Put page-specific styles in `src/styles/css/pages/` and import them from `src/styles/index.css`

**Add a new field to inventory:**
1. Add the field to book documents in Firestore and the admin book form (`src/pages/admin/BookModal.jsx`)
2. Normalize the field in `src/lib/inventory.js` and `normalizeBookSnapshot` in `src/pages/admin/helpers.js`
3. Expose it in the catalog table in `src/pages/CatalogPage.jsx`

**Edit site copy:** open the page's `.jsx` file and edit the text in place.

## License

Built for the Free Textbook Library at the College of Charleston. Adapt freely for similar student-run mutual aid projects.
