# Free Textbook Library

A lightweight, volunteer-friendly inventory management site for the College of Charleston's Free Textbook Library. Built with vanilla HTML/CSS/JS and designed for Firebase Hosting.

> **If you're a library volunteer, don't start here — read `SETUP_GUIDE.md` instead.** This README is for developers.

---

## Architecture

Google Sheet (source of truth) → Published as CSV → Fetched by `inventory.js` → Rendered into catalog table
Google Form (request submission) → Responses sheet → Email to library email

No backend, no build step, no database. All logic runs in the browser. State lives in the Google Sheet.

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
│   ├── main.js             Shared init: content.json loader, nav, footer, toast
│   ├── inventory.js        Google Sheet CSV fetcher, filter/sort helpers
│   └── firebase-config.js  Optional Firebase scaffold (commented out)
│
├── data/
│   ├── content.json        ALL editable text + integration URLs
│   └── seed-inventory.json Fallback inventory (142 books, pre-loaded)
│
└── assets/images/          (empty — drop in logo, photos, etc.)
```

## Key architectural decisions

**Content as data.** Every editable string on every page is pulled from `data/content.json`. HTML files contain `[data-*]` hooks that get populated at runtime. Volunteers can change headlines, stats, contact info, and integration URLs without touching markup.

**CSV fetch fallback pattern.** `inventory.js` tries to fetch the published Google Sheet CSV first. If that URL isn't configured yet — or if the fetch fails — it falls back to `seed-inventory.json`. This means the site works out of the box with the 142-book seed data, and gracefully upgrades to live sheet data once configured.

**No-CORS Google Form submission.** Google Forms doesn't allow CORS on the submission endpoint, so we use `fetch(url, { mode: 'no-cors' })`. We can't read the response, but the submission succeeds. If the form isn't configured, the request modal falls back to a `mailto:` link.

**Password "auth" on admin page.** Intentionally simple — the password is plaintext in `content.json`, which is publicly served. This is fine for a student-run library where the goal is friction-reduction, not hardening against attackers. For real auth, swap in Firebase Auth (see `js/firebase-config.js` for the scaffold).

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
2. Add a link in `data/content.json` → `nav[]`
3. Create `css/pages/newpage.css` for page-specific styles

**Add a new field to inventory (e.g. author):**
1. Add `Author` column to the Google Sheet
2. `inventory.js` already auto-detects an author column — just expose it in the catalog table by editing `catalog.html`'s `renderTable()` function

**Switch from shared password to real auth:**
1. Uncomment `js/firebase-config.js` and fill in your Firebase config
2. Replace the password check in `admin.html` with `signInWithEmailAndPassword`

## License

Built for the Free Textbook Library at the College of Charleston. Adapt freely for similar student-run mutual aid projects.
