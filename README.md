# Simulated Biofeedback Icon Validation Study

A polished, browser-based validation experiment for animated “Signal Core” interface icons representing **simulated** heart-rate (HR) activation and heart-rate-variability (HRV) stability states.

## What the experiment tests

The study examines whether participants can interpret ambient teammate-status cues without numerical values or diagnostic labels. It includes an unaided interpretation phase, a visual legend, and a randomized 4 × 4 within-subjects recognition phase covering all 16 HR × HRV conditions.

All HR and HRV states are simulated. The site does not connect to Apple Watch, HealthKit, sensors, cameras, microphones, Bluetooth, or external devices, and it does not collect real health data.

## File structure

- `index.html` — semantic page shell
- `style.css` — responsive layout, Signal Core visuals, and animations
- `app.js` — experiment flow, randomization, validation, persistence, and export
- `README.md` — setup and study notes

## Run locally

1. Download the project folder.
2. Open `index.html` in a modern browser.

No build step, server, package installation, or internet connection is required.

## Deploy on GitHub Pages

1. Create a GitHub repository.
2. Upload the four project files to the repository root.
3. Open **Settings → Pages** in the repository.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)` folder, then save.

GitHub will provide the public study URL after deployment.

## Collect data

At the end of the experiment, ask each participant to export CSV, JSON, or both and send the files to the researcher using the approved study procedure. Alternatively, a researcher can run the study in a supervised setting and collect the exported files directly.

The CSV uses one row per trial, repeats demographics and final responses for convenient analysis, and includes timing, order, condition, device, and answer fields. It opens in Excel and Google Sheets and imports into R, Python, or SPSS. The JSON preserves the nested study structure.

Progress is backed up in browser `localStorage` after every page and trial. It remains available after refresh until **Restart Study** is confirmed.

## Data Collection and Excel Export

The completed study automatically sends a normalized 22-row participant dataset to the configured researcher-controlled Google Sheet through a Google Apps Script Web App. The results page shows delivery status and provides a retry action. Server-side and browser-side duplicate protection use the participant ID.

During development, `ALLOW_REPEAT_SUBMISSIONS_FOR_TESTING` in `app.js` can temporarily permit repeated submissions from the same participant. Set it to `false` before real data collection to restore duplicate protection.

Participants can also export their own CSV, Excel-compatible `.xls`, or JSON file from the final page. These downloads should be retained as a backup to the online submission.

The `data` folder contains a header-only template, a complete data dictionary, and collection guidance. CSV files use a consistent 22-row structure per completed participant and UTF-8 formatting for Excel, Google Sheets, SPSS, R, and Python. The Excel-compatible export presents Participant Summary, Demographics, Phase A Trial Data, Phase B Trial Data, and Final Questionnaire as clearly labeled tables.

GitHub Pages cannot save files server-side by itself. This project uses the configured Google Apps Script endpoint as its external collection service; it does not contain a server or database. In a supervised lab study, the researcher can also move downloaded participant files into the `data` folder manually.

## Modify visual mappings

Edit `HR_STATES` and `HRV_STATES` near the top of `app.js`.

- HR parameters control pulse duration, glow strength, halo expansion, and brightness.
- HRV parameters control ring type, segment count, jitter, fragmentation, opacity irregularity, and wobble duration.

The 16 conditions are generated automatically from those two objects. Shared animation behavior and appearance can be adjusted in `style.css` under the avatar and animation sections.

## Ethics and participant care

- No real health or physiological data is collected.
- The icons are not medical indicators and do not provide emotional diagnoses.
- Participation should remain voluntary, and participants may stop by closing the browser.
- The consent screen states how responses may be used and exported.
- Animated pulsing, jitter, and flicker may affect motion-sensitive participants. Researchers should provide a motion-sensitivity warning before participation and honor operating-system reduced-motion preferences.
