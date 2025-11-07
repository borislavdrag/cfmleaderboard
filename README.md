# cfmleaderboard

Modernised single-page leaderboard for Friday Night Lights. The site now ships with a responsive Vue-powered experience, animated UI blocks, and a score submission drawer that can post directly into Google Sheets (or any HTTPS endpoint you point it to).

## What's included

- 🔁 **Live leaderboard** fed from a published Google Sheet or JSON API (configured via `config.js`).
- 📱 **Responsive / mobile-first** layout with sticky headers, collapsible tabs, and touch-friendly interactions.
- 📝 **Score intake drawer** that posts JSON payloads to Google Apps Script, Airtable, Supabase, etc.
- 🧱 **Workouts section** that hydrates from the same data feed, so event cards stay in sync with Sheets.

## Quick start

1. Serve the site (any static server works) or simply open `index.html` in your browser while iterating.
2. Update `config.js` with your sheet + submission URLs (see below) and set an `adminPassword` for the protected panel.
3. Edit `workouts.json` to rename WODs, their focus, and descriptions.
4. Refresh the page — the leaderboard hydrates automatically.

## Configure the leaderboard feed (Google Sheets)

1. Create a Google Sheet with columns in this order:
   ```
   division | workout | name | score | tiebreak | rx
   ```
   (Points/rank are computed automatically in the UI, so you do **not** need a points column in the sheet.)
2. Populate rows as judges input results. Each row should represent one athlete's score for a specific workout. Times beat reps when mixed; within times the faster result wins, within reps the higher number wins, and tie-break times resolve any draws. RX should be `Yes` or `No`.
3. The on-page ranking engine awards 100 points to first place in each division/workout and decreases by 5 points per place (95, 90, ...), bottoming out at 0.
4. Publish the sheet to the web:
   - `File → Share → Publish to web`
   - Choose the worksheet that contains the leaderboard data
   - Select `Comma-separated values (.csv)` and copy the generated link
5. Open `config.js` and paste that link into `leaderboardFeed`.

The app detects JSON or CSV automatically, normalises headers, and rebuilds the tables every time the page loads (or when you hit **Refresh data**).

## Score submission via Google Apps Script (optional)

1. In your sheet, add a hidden tab named `Submissions` (or reuse the leaderboard tab if you want one source of truth).
2. Open `Extensions → Apps Script` and paste the tiny web app below:

```js
const SHEET_NAME = 'Submissions';

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  sheet.appendRow([
    new Date(),
    body.division,
    body.workout,
    body.name,
    body.score,
    body.tiebreak,
    body.rx,
    body.token,
  ]);
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok' })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

3. `Deploy → Test deployments → Select type: Web app` and choose *Anyone with the link* (or require a token).
4. Copy the Web App URL and set it as `scoreEndpoint` in `config.js`. Optional: set `submissionToken` to match a token column in the sheet for simple auth.

Now the on-page drawer can capture scores on phones or tablets and push them straight into Sheets. Once your sheet formulas/queries update, click **Refresh data** on the site to pull the latest standings.

## Development notes

- Stack: vanilla HTML + CSS + [Vue 3 (CDN build)](https://vuejs.org/). Everything runs statically—no build tools required.
- Styling lives in `styles.css`. Colors stay aligned with CFM’s navy + coral palette; tweak CSS variables at the top to rebrand.
- `workouts.json` controls the five WOD names and blurbs that appear in the UI and in the submission dropdown.
- `script.js` is a native ES module; feel free to extend the normaliser if you add extra sheet columns.

Have fun running your event—and let me know if you need a JSON schema or app script tweaks!
