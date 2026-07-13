# Deploying the data collection backend

`Code.gs` is the Google Apps Script that receives each participant's completed
study data (sent by `submitStudyDataOnline()` in `app.js`) and appends it to a
Google Sheet. The Sheet can be downloaded as a real `.xlsx` file at any time
(**File → Download → Microsoft Excel (.xlsx)**), and it always reflects every
participant who has completed the study so far.

GitHub Pages only serves static files and cannot write data anywhere by
itself, so this Apps Script Web App is the actual storage backend for the
live site.

## One-time setup

1. Go to [sheets.google.com](https://sheets.google.com) and create a new
   blank spreadsheet. Name it something like `SBIV Study Data`.
2. In the spreadsheet, open **Extensions → Apps Script**.
3. Delete the placeholder `Code.gs` content and paste in the contents of
   this folder's `Code.gs`.
4. Save the project (e.g. name it `SBIV Data Collector`).
5. Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Description: anything, e.g. `SBIV intake`.
   - Execute as: **Me**.
   - Who has access: **Anyone**.
6. Click **Deploy**. Google will ask you to authorize the script — this is
   your own script acting on your own Sheet, so click through the consent
   screen (**Advanced → Go to \[project name] (unsafe)** is expected for a
   script you just wrote yourself; it isn't a warning about a third party).
7. Copy the **Web app URL** shown after deployment (it ends in `/exec`).
8. Paste that URL into `app.js` as the value of `GOOGLE_SCRIPT_URL`
   (currently near the top of the file), replacing the existing value.

## Verifying it works

- Visiting the deployed URL directly in a browser should return
  `{"status":"ok","message":"SBIV data collection endpoint is running."}`.
- Complete a full run of the study on the live site. A `Responses` sheet
  tab should appear in your spreadsheet with a header row followed by 22
  rows for that participant.
- Before collecting real participant data, set
  `ALLOW_REPEAT_SUBMISSIONS_FOR_TESTING = false` in `app.js` — while `true`,
  repeat test submissions bypass duplicate protection and each gets a
  unique `-TEST-<timestamp>` suffix appended to the participant ID.

## Redeploying after editing Code.gs

Apps Script Web App URLs stay the same across **Manage deployments → Edit →
Deploy** as long as you edit the existing deployment rather than creating a
new one. If you ever create a brand new deployment instead, you'll get a new
URL and will need to update `GOOGLE_SCRIPT_URL` in `app.js` again.

## Getting the Excel file

At any point, open the Google Sheet and use **File → Download → Microsoft
Excel (.xlsx)** to get a standalone `.xlsx` snapshot of every participant
collected so far. The Sheet itself is always the live, continuously updated
source; the `.xlsx` download is a point-in-time export of it.
