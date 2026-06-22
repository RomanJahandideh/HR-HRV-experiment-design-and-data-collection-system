# Participant Data Files

This folder documents the export format for the **Simulated Biofeedback Icon Validation Study**.

## How data collection works

This website is a static HTML, CSS, and JavaScript project. A static site cannot write participant results into this local `data` folder after local use or GitHub Pages deployment. Instead, completed responses are automatically sent to the researcher-controlled Google Sheet through the configured Google Apps Script Web App.

Participants can still download CSV, Excel-compatible, or JSON files as a backup. For a supervised lab study, the researcher may move those downloaded files into this folder after each session.

## Included reference files

- `participant_data_template.csv` contains the expected column headers.
- `participant_data_dictionary.csv` defines every column, its data type, allowed values, and interpretation notes.

Participant files share a consistent flat structure and can be combined later in Microsoft Excel, Google Sheets, SPSS, R, or Python. Each completed export contains one demographics row, 20 trial rows, and one final-questionnaire row.

## Data scope

No real physiological or health data is collected. All HR and HRV conditions displayed by the study are simulated interface states. The icon is not a medical indicator or emotional diagnosis.
