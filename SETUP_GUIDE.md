# Setup Guide — Free Textbook Library Website

**For the person managing the library (no coding experience required).**

This guide walks you through connecting the website to a Google Sheet (for inventory) and a Google Form (for book requests), then publishing the site online. It takes about 30–45 minutes end to end.

---

## What this website does

- **Home page**: explains the library to students
- **Catalog page**: shows every book in your Google Sheet — students can search, filter, and tap "Request"
- **Admin page**: password-protected, gives volunteers quick links to the Google Sheet/Form
- **Google Sheet**: the single place volunteers edit inventory — the website auto-reads from it
- **Google Form**: collects student book requests → writes to a response sheet + emails you

You edit the **Google Sheet**. The website updates itself. That's the whole system.

---

## Part 1 — Set up the Inventory Google Sheet

### 1. Create the sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a blank sheet
2. Name it something like `Free Textbook Library — Inventory`
3. In **Row 1**, type these exact column headers (in this order):

   | A | B | C | D | E |
   |---|---|---|---|---|
   | Title | ISBN | Subject | Status | Quantity |

4. Copy your existing inventory into the rows below (starting in Row 2). The website ships with 142 books pre-loaded from your CSV as a fallback, but once the sheet is connected, the sheet wins.

### 2. The Status column rules

Only use these three values in the Status column:

- `Available` — book is on the shelf
- `Pending` — student requested it, waiting for volunteer to confirm
- `Checked Out` — book is with a student / missing

Anything else defaults to `Available` on the website.

### 3. Publish the sheet as CSV

This is how the website reads the sheet — no API keys, no logins required.


1. Open your sheet
2. Click **File** → **Share** → **Publish to web**
3. In the dialog:
   - **Link** tab
   - Dropdown 1: select the sheet tab (usually "Sheet1")
   - Dropdown 2: select **Comma-separated values (.csv)**
4. Click **Publish** → confirm
5. **Copy the URL that appears.** It looks like:
   ```
   https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv
   ```
6. Save that URL — you'll paste it into the website in Part 3.

https://docs.google.com/spreadsheets/d/e/2PACX-1vRywNOt0C1RVsAbBw-YphcdOhadKb47NxYr18CyPqp9pc1yR4sM4tUvAw9YSCV_4KplAoOj0AFBo8mM/pub?gid=1479555627&single=true&output=csv


### 4. Get the edit link (for volunteers)

1. Click **Share** (top right) → set access to "Anyone with the link" → **Viewer** or **Editor** depending on how open you want it
2. Copy the full URL from your browser bar (it ends in `/edit`)
3. Save that URL too — volunteers will use it to update inventory

https://docs.google.com/spreadsheets/d/1ldvs2Knjhkgrp7Lf5p8ugNY9RRLw7DuP_3iwviZbuz4/edit?usp=sharing

## Part 2 — Set up the Request Google Form

### 1. Create the form

1. Go to [forms.google.com](https://forms.google.com) → Blank form
2. Title: `Book Request — Free Textbook Library`
3. Add these fields:

   | Field label | Type | Required? |
   |---|---|---|
   | Book Title | Short answer | Yes |
   | ISBN | Short answer | No |
   | Author(s) | Short answer | No |
   | Course Name and Number (e.g., MATH 101, HIST 210) | Short answer | No |
   | Do you need a physical copy or an electronic version (if available)? | Multiple choice | No |
   | Your Name | Short answer | Yes |
   | CofC Email | Short answer (with email validation) | Yes |
   | Notes | Paragraph | No |
   | How would you rate the availability of affordable textbooks currently? | Linear scale (1–5, labels: Very Poor / Excellent) | No |

   https://docs.google.com/forms/d/e/1FAIpQLSdScyTBuAhv2oQEUcso25Opkj_OQYVbHLbsjdUSGfYDxhNC-g/viewform?usp=publish-editor

### 2. Connect the form to a response sheet

1. In the form, click the **Responses** tab
2. Click the green Sheets icon → "Create a new spreadsheet" → **Create**
3. This is your "Request Responses" sheet — save the URL

https://docs.google.com/spreadsheets/d/1D7LDV-FAl-1iOVCGbqS97ekQvlciDVcfgYzRlG-sR4M/edit?usp=sharing


### 3. Turn on email notifications

1. In the form, still on the **Responses** tab, click the three-dot menu
2. Turn on **Get email notifications for new responses**
3. Email alerts now go to your Google account for every request

### 4. Get the form's field IDs (the tricky part)

This is the ONLY genuinely technical step. Take your time.

1. Open the form as if you were a student (click the **Send** button → copy the link with `/viewform`)
2. Open that student-facing URL in a **new tab**
3. Right-click anywhere → **View page source** (or press `Ctrl+U` / `Cmd+Option+U`)
4. Press `Ctrl+F` / `Cmd+F` and search for `entry.`
5. For each field, you'll find something like:
   ```html
   name="entry.1234567890"
   ```
   Match each `entry.XXXXXXX` to its field by looking at the surrounding context (the field label appears nearby).
6. Write down 9 entry IDs — one per field:

   | Field | entry ID |
   |---|---|
   | Book Title | entry._________ |
   | ISBN | entry._________ |
   | Author(s) | entry._________ |
   | Course Name and Number | entry._________ |
   | Physical / Electronic Preference | entry._________ |
   | Your Name | entry._________ |
   | CofC Email | entry._________ |
   | Notes | entry._________ |
   | Availability Rating | entry._________ |

### 5. Get the form submission URL

1. On the form, click **Send** → copy the link
2. Replace `/viewform` at the end with `/formResponse`
3. Final URL looks like:
   ```
   https://docs.google.com/forms/d/e/1D7LDV-FAl-1iOVCGbqS97ekQvlciDVcfgYzRlG-sR4M/formResponse
   ```
4. Save this URL.

### 6. Get the form edit URL

1. Just copy the URL from your browser bar while viewing/editing the form
2. Should end in `/edit`

---

## Part 3 — Connect everything to the website

Open the file **`data/content.json`** in any text editor (Notepad, TextEdit, VS Code — anything).

Find the `integrations` and `admin` sections near the top. Fill in your URLs:

```json
"integrations": {
  "googleSheetCsvUrl": "PASTE_YOUR_PUBLISHED_CSV_URL_HERE",
  "googleFormUrl": "PASTE_YOUR_FORM_RESPONSE_URL_HERE",
  "googleFormBookTitleField": "entry.XXXXXXX",
  "googleFormIsbnField": "entry.XXXXXXX",
  "googleFormAuthorField": "entry.XXXXXXX",
  "googleFormCourseField": "entry.XXXXXXX",
  "googleFormFormatField": "entry.XXXXXXX",
  "googleFormNameField": "entry.XXXXXXX",
  "googleFormEmailField": "entry.XXXXXXX",
  "googleFormMessageField": "entry.XXXXXXX",
  "googleFormAvailabilityRatingField": "entry.XXXXXXX"
},

"admin": {
  "password": "CHANGE_THIS_PASSWORD",
  "requestsSheetUrl": "PASTE_YOUR_RESPONSES_SHEET_URL",
  "inventorySheetEditUrl": "PASTE_YOUR_INVENTORY_EDIT_URL",
  "formEditUrl": "PASTE_YOUR_FORM_EDIT_URL"
}
```

**Change the password.** The default (`books2026`) is in the public code — anyone can see it. Change it before sharing the admin link.

Save the file.

---

## Part 4 — Deploy to Firebase (make the website public)

### 1. One-time setup

1. Go to [firebase.google.com](https://firebase.google.com) → Sign in with a Google account
2. Click **Add project** → name it `free-textbook-library` (or similar) → Continue → disable Google Analytics (not needed) → Create
3. On your computer, install Node.js from [nodejs.org](https://nodejs.org) (download the LTS version)
4. Open your Terminal (Mac) or Command Prompt (Windows)
5. Run:
   ```
   npm install -g firebase-tools
   ```
6. Log in:
   ```
   firebase login
   ```
   (A browser window opens — sign in with the same Google account)

### 2. Connect this project to Firebase

1. Open `.firebaserc` in a text editor
2. Replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` with your actual Firebase Project ID
   - Find the Project ID in Firebase Console → Project settings (gear icon) → "Project ID"
3. Save

### 3. Enable Hosting

1. In the Firebase Console, click **Hosting** in the left sidebar → **Get started** → just click through the wizard until it's enabled

### 4. Deploy

1. In your Terminal, navigate into the project folder:
   ```
   cd path/to/free-textbook-library
   ```
2. Deploy:
   ```
   firebase deploy
   ```
3. After a minute, you'll see a URL like `https://free-textbook-library.web.app` — that's your live website.

---

## Part 5 — Day-to-day use (volunteer workflow)

**To add a book:**
1. Open the Inventory Sheet
2. Scroll to the bottom, add a new row with: Title, ISBN, Subject, Status (`Available`), Quantity
3. Save. Website updates within ~5 minutes.

**To mark a book checked out:**
1. Find the row in the Inventory Sheet
2. Change Status to `Checked Out`

**To handle a student request:**
1. You'll get an email when a student submits a request
2. Open the Request Responses sheet to see details
3. Find the book in the Inventory Sheet, change Status to `Pending` (or `Checked Out` once picked up)
4. Reply to the student's email to arrange pickup

**To add a volunteer:**
1. Share the Inventory Sheet edit URL with them
2. Share the admin password (or change it and share the new one)
3. Point them to the admin page on the website

---

## Updating website content (headlines, about section, contact info)

All text shown on the site lives in `data/content.json`. Change any value in that file, then redeploy with:

```
firebase deploy
```

No HTML editing required.

---

## Troubleshooting

**"The catalog shows old books / nothing from my sheet"**
- Make sure the sheet is published as CSV (Part 1, Step 3) and the URL is pasted correctly in `content.json`
- Google caches published CSV for ~5 minutes — wait and refresh
- Confirm your column headers exactly match: `Title`, `ISBN`, `Subject`, `Status`, `Quantity`

**"Students say the Request button isn't working"**
- If the Google Form URL isn't set, the button falls back to opening an email — that's intentional
- Double-check the form submission URL ends in `/formResponse`, not `/viewform`
- Test it yourself: open the site, tap Request, submit. Then check the Responses sheet.

**"I forgot the admin password"**
- Open `data/content.json` → change the password value → redeploy

**"Website is down / domain stopped working"**
- Firebase free tier doesn't expire. Confirm you're logged in: `firebase login`
- Redeploy: `firebase deploy`

---

## Want to upgrade later?

The current setup is intentionally simple — Google Sheets + public CSV + static hosting. If the library grows, you can:

- **Upgrade auth**: swap the shared password for real accounts via Firebase Authentication (see `js/firebase-config.js`)
- **Move requests to Firestore**: skip Google Forms, store requests directly in a real database
- **Add book covers**: extend the sheet with an image URL column, update the catalog template

Those are all doable without rebuilding the site.

---

**Questions?** The code is intentionally small and commented. Every text string lives in `data/content.json`. Every style token lives in `css/variables.css`. Every piece of logic has a short file with a clear name. If something breaks, those are the three places to look first.
