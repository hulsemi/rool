# Electron Semi — Website

A static semiconductor/VLSI company website (HTML/CSS/vanilla JS) built for
GitHub Pages, with **Google Apps Script + Google Sheets** as the serverless
form backend (no Node.js, PHP, database, or paid form service).

```
/
├── index.html
├── about.html
├── services.html
├── careers.html
├── contact.html
├── privacy.html
├── css/
│   └── style.css
├── js/
│   └── script.js          ← CONFIG.APPS_SCRIPT_URL goes here
├── assets/
│   ├── logo.jpeg
│   └── wordmark.jpeg
├── apps-script/
│   └── Code.gs             ← paste into script.google.com (not deployed to GitHub Pages)
└── README.md
```

Only the files **outside** `apps-script/` get hosted on GitHub Pages. The
`Code.gs` file lives in a separate Google Apps Script project tied to your
Google Sheet — it is not part of the public website.

---

## How it works

```
Visitor → GitHub Pages site → Career / Service / Contact form
        → JavaScript (fetch, text/plain body) → Google Apps Script Web App
        → Web App: validates input, writes row to Google Sheet,
                    uploads resume (career form) to Google Drive,
                    sends you a notification email
        → Web App returns JSON → website shows a success message (no redirect)
```

Every form (`data-es-form="service|career|contact"` in the HTML) is wired up
automatically by `js/script.js`. There's a hidden honeypot field on each form
for basic spam protection, plus required-field and email validation on both
the client and the server (`Code.gs`).

---

## Part 1 — Google Sheets & Apps Script setup

**1. Create the Google Sheet**
Go to [sheets.google.com](https://sheets.google.com) → Blank spreadsheet.
Rename it, e.g. `Electron Semi — Website Submissions`.

**2. Create the required tabs**
At the bottom, create three sheet tabs named **exactly**:
- `Service Enquiries`
- `Career Applications`
- `Contact Messages`

(The script will add header rows automatically the first time each tab
receives a submission — you don't need to type headers yourself.)

**3. Open the Apps Script editor**
In the Sheet: `Extensions → Apps Script`. This opens a script project bound
to your spreadsheet — no separate setup needed.

**4. Add the script**
Delete the default `Code.gs` contents and paste in the entire contents of
`apps-script/Code.gs` from this project.

**5. Set your notification email**
In the pasted code, find:
```js
const NOTIFY_EMAIL = "YOUR_EMAIL@example.com";
```
Replace it with the email address that should receive notifications.

**6. Create the Google Drive folder for resumes**
Go to [drive.google.com](https://drive.google.com) → New → Folder. Name it
something like `Electron Semi — Resumes`.

**7. Get the Drive folder ID**
Open the folder. The URL looks like:
```
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
```
The part after `/folders/` is the folder ID. Copy it.

Back in `Code.gs`, find:
```js
const RESUME_FOLDER_ID = "YOUR_DRIVE_FOLDER_ID";
```
Replace it with that ID.

**8. Save the script**
Click the disk/save icon (or Ctrl/Cmd+S). Give the project a name if asked,
e.g. `Electron Semi Website Backend`.

**9. Deploy as a Web App**
Click **Deploy → New deployment**.
- Click the gear icon next to "Select type" → choose **Web app**.
- Description: `Electron Semi form handler` (anything you like).
- **Execute as:** `Me (your account)`
- **Who has access:** `Anyone`
- Click **Deploy**.

**10. Authorize the script**
The first deploy will ask you to authorize permissions (Sheets, Drive,
Gmail/MailApp). Click **Authorize access**, choose your Google account, and
if you see an "unverified app" warning click **Advanced → Go to (project
name) (unsafe)** — this is expected for a script you wrote yourself. Click
**Allow**.

**11. Copy the Web App URL**
After deployment, you'll see a URL that looks like:
```
https://script.google.com/macros/s/AKfycb.../exec
```
Copy this exact URL.

---

## Part 2 — Connect the website to Apps Script

**12. Add the URL to the website**
Open `js/script.js` and find:
```js
const CONFIG = {
  APPS_SCRIPT_URL: "YOUR_APPS_SCRIPT_WEB_APP_URL",
  COMPANY_NAME: "Electron Semi"
};
```
Replace `"YOUR_APPS_SCRIPT_WEB_APP_URL"` with the URL you copied in step 11.
Save the file.

---

## Part 3 — Deploy to GitHub Pages

**13. Create the GitHub repository**
On [github.com](https://github.com), click **New repository**. Name it
anything (e.g. `electron-semi-website`). Keep it public (GitHub Pages on a
free plan requires a public repo, unless you have GitHub Pro/Team).

**14. Upload the website files**
Either:
- Use the GitHub web UI: **Add file → Upload files**, then drag in
  everything **except** the `apps-script/` folder (that one stays local —
  it's not part of the public site), or
- Use git from your computer:
  ```bash
  git init
  git add .
  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
  git commit -m "Initial website"
  git branch -M main
  git push -u origin main
  ```

**15. Enable GitHub Pages**
In the repo: **Settings → Pages**.
- Under "Build and deployment", **Source**: `Deploy from a branch`.
- **Branch**: `main`, folder: `/ (root)`.
- Click **Save**.

GitHub will give you a URL like `https://YOUR_USERNAME.github.io/YOUR_REPO/`.
It can take a minute or two to go live.

**16. Connect your custom domain**
Still in **Settings → Pages → Custom domain**, enter your domain (e.g.
`www.electronsemi.com`) and save. GitHub will create a `CNAME` file in your
repo automatically.

**17. Create the required DNS records**
At your domain registrar / DNS provider:
- For a subdomain like `www`: add a **CNAME** record pointing `www` to
  `YOUR_USERNAME.github.io`.
- For an apex/root domain (e.g. `electronsemi.com` with no `www`): add **A**
  records pointing to GitHub's IPs:
  ```
  185.199.108.153
  185.199.109.153
  185.199.110.153
  185.199.111.153
  ```
  (and optionally AAAA records for IPv6 — see GitHub's docs for current
  values if these change).

**18. Enable HTTPS**
Back in **Settings → Pages**, once DNS has propagated (can take up to a few
hours), check **Enforce HTTPS**.

---

## Part 4 — Test everything

**19. Test the Service form**
Go to your live site → Services → fill out and submit the "Request a
Service" form. You should see a success message with no redirect.

**20. Test the Career form (including resume upload)**
Go to Careers → fill out the application form, attach a small PDF or Word
file, and submit.

**21. Test the Contact form**
Go to Contact → submit a test message.

**22. Check Google Sheets**
Open your spreadsheet. Each submission should appear as a new row in the
matching tab (`Service Enquiries`, `Career Applications`, or
`Contact Messages`), with a timestamp.

**23. Check email notifications**
Confirm you received an email at `NOTIFY_EMAIL` for each test submission,
with a subject like `New Career Application – Analog Layout Engineer`.

**24. Check the resume upload**
Open the Drive folder from step 6 — your test resume file should be there,
and the corresponding Sheet row should contain its URL.

---

## Setup checklist

- [ ] Google Sheet created with tabs: `Service Enquiries`, `Career Applications`, `Contact Messages`
- [ ] `apps-script/Code.gs` pasted into Extensions → Apps Script
- [ ] `NOTIFY_EMAIL` set in `Code.gs`
- [ ] Google Drive folder created for resumes, folder ID copied
- [ ] `RESUME_FOLDER_ID` set in `Code.gs`
- [ ] Apps Script deployed as Web App (Execute as: Me, Access: Anyone)
- [ ] Script authorized (Sheets / Drive / Gmail permissions granted)
- [ ] Web App URL copied
- [ ] `CONFIG.APPS_SCRIPT_URL` set in `js/script.js`
- [ ] GitHub repo created, website files pushed (excluding `apps-script/`)
- [ ] GitHub Pages enabled (Settings → Pages → Deploy from branch)
- [ ] Custom domain added in GitHub Pages settings
- [ ] DNS records (CNAME and/or A records) created at your registrar
- [ ] HTTPS enforced once DNS has propagated
- [ ] All three forms tested live (Service, Career + resume, Contact)
- [ ] Sheet rows confirmed for each test submission
- [ ] Notification emails confirmed
- [ ] All placeholder text (`[PLACEHOLDER — ...]`) replaced throughout the site
- [ ] `privacy.html` reviewed/edited to reflect your actual data practices

---

## Security & privacy notes

- **No secrets in the frontend.** The only thing exposed client-side is the
  Apps Script Web App URL, which is expected — the browser has to call it
  directly. There are no API keys, passwords, or Sheet IDs in any HTML/JS
  file.
- **The Sheet ID never appears in the frontend.** `Code.gs` uses
  `SpreadsheetApp.getActiveSpreadsheet()` because it's bound to the sheet,
  so the ID doesn't need to be hardcoded or exposed anywhere.
- **Spam protection.** Each form has a hidden honeypot field
  (`name="website"`) — legitimate visitors never see or fill it, but simple
  bots often do, so those submissions are silently discarded.
- **Validation happens twice.** Required fields, email format, and payload
  size are checked in `js/script.js` (fast feedback for the visitor) and
  again in `Code.gs` (`validate()`), since client-side checks can be
  bypassed and the server must not trust the client.
- **Resume files** are private-by-default in the Drive folder unless you
  change sharing settings; the script sets each uploaded file to
  "Anyone with the link — Viewer" so you can open the link from the Sheet.
  Adjust `saveResumeToDrive()` in `Code.gs` if you'd prefer stricter sharing.
- **Review `privacy.html`** and update it to accurately describe your real
  data practices before publishing — the included text is a starting point,
  not legal advice.

---

## Notes on the resume upload approach

Google Apps Script Web Apps do not reliably handle `multipart/form-data`
uploads from a cross-origin `fetch()` call. The workaround used here:

1. The browser reads the selected resume file and base64-encodes it
   client-side (`fileToBase64()` in `js/script.js`).
2. It's sent as a field inside the same JSON payload as the rest of the form
   data — the whole request body is `text/plain` (not `multipart/form-data`
   and not `application/json`), which keeps it a CORS "simple request" and
   avoids the preflight `OPTIONS` call that Apps Script can't answer.
3. `Code.gs` decodes the base64 string back into a file (`Blob`) and saves
   it to your designated Drive folder, then writes the resulting file URL
   into the Google Sheet row.

This keeps the whole flow within Apps Script + Drive + Sheets, with no
third-party file-upload service, and works reliably for typical resume file
sizes (the frontend enforces a 5 MB cap — adjust `maxBytes` in
`js/script.js` and Apps Script's own limits if you need something larger).
