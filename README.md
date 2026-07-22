# Free Textbook Library

A lightweight, volunteer-friendly inventory management site for the College of Charleston's Free Textbook Library. Built with vanilla HTML/CSS/JS and designed for Firebase Hosting.

> **If you're a library volunteer, don't start here — read `SETUP_GUIDE.md` instead.** This README is for developers.

---

## Architecture

This is a no-build vanilla HTML, CSS, and JavaScript site backed by Firebase:

- Page copy and semantic structure live directly in each HTML file.
- Shared design tokens and components live in `css/`.
- Browser behavior and Firebase integration live in `js/`.
- Firestore stores the live catalog and student requests.
- Firebase Authentication protects the admin dashboard.
- `data/seed-inventory.json` provides a local fallback catalog.

## File structure

```
free-textbook-library/
├── index.html              Home page
├── catalog.html            Filterable catalog + request modal
├── admin.html              Password-gated volunteer dashboard
├── firebase.json           Firebase Hosting config
├── .firebaserc             Firebase project alias
├── SETUP_GUIDE.md          Non-technical setup walkthrough
├── README.md               This file
│
├── css/
│   ├── variables.css       Design tokens (colors, fonts, spacing)
│   ├── reset.css           Minimal CSS reset
│   ├── global.css          Shared styles (nav, footer, buttons, pills)
│   └── pages/
│       ├── home.css
│       ├── catalog.css
│       └── admin.css
│
├── js/
│   ├── main.js             Shared UI helpers
│   ├── inventory.js        Firestore inventory fetch/filter/sort helpers
│   └── firebase-config.js  Firebase client configuration
│
├── data/
│   └── seed-inventory.json Fallback inventory (pre-loaded)
│
└── assets/images/          (empty — drop in logo, photos, etc.)
```

## Key architectural decisions

**Content in HTML.** Each page's copy, navigation, and footer are written directly in its HTML file. The site remains readable before JavaScript loads, and content edits do not require tracing data through a separate JSON layer.

**Firestore with a local fallback.** `inventory.js` reads the live `books` collection from Firestore. If Firebase is unavailable, it falls back to `seed-inventory.json`, so the public catalog can still render.

**Requests in Firestore.** The catalog writes student requests to the `requests` collection. If Firebase is unavailable, it falls back to a pre-filled email.

**Atomic checkout and return flow.** Admins mark pending requests fulfilled to decrement the matching book's available quantity. Fulfilled requests appear under Checked Out; marking one returned restores a copy. Firestore transactions keep the request and inventory changes in sync.

**Firebase admin authentication.** The admin form signs in through Firebase Authentication, then verifies the user's matching Firestore admin document before showing the dashboard.

## Design tokens

All design decisions live in `css/variables.css`:

- **Primary**: `#1f3a2e` (forest green)
- **Accent**: `#c25a3e` (terracotta)
- **Paper**: `#faf6ef` (warm off-white)
- **Display font**: Fraunces (variable weight + optical size)
- **Body font**: Inter Tight

## Local development

No build step. Just open any HTML file in a browser — though because the JS uses ES modules and `fetch()` on relative paths, you'll need to serve it over HTTP:

```bash
# Python
python3 -m http.server 8000

# Or Node
npx serve
```

Then visit `http://localhost:8000`.

## Deployment

```bash
npm install -g firebase-tools
firebase login
firebase init hosting    # only if .firebaserc needs setup
firebase deploy
```

Full setup instructions for non-developers are in `SETUP_GUIDE.md`.

## Extending

**Add a new page:**
1. Create `newpage.html`, copy the `<nav>` and `<footer>` scaffolding from `index.html`
2. Add the new navigation link to the HTML pages where it should appear
3. Create `css/pages/newpage.css` for page-specific styles

**Add a new field to inventory (e.g. author):**
1. Add the field to book documents in Firestore and the admin book form
2. Normalize the field in `js/inventory.js`
3. Expose it in the catalog table by editing `catalog.html`'s `renderTable()` function

**Edit site copy:**
1. Open the HTML file for the page you want to change
2. Edit the text directly in the relevant semantic element
3. Keep behavior in JavaScript and presentation in CSS

## License

Built for the Free Textbook Library at the College of Charleston. Adapt freely for similar student-run mutual aid projects.
