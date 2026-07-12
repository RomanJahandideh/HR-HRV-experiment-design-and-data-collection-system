/**
 * SBIV Study data intake.
 * Receives the payload posted by app.js (submitStudyDataOnline) and appends
 * one row per record to the "Responses" sheet, skipping duplicate participant IDs.
 *
 * Deployment: see README.md in this folder.
 */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const payload = JSON.parse(e.postData.contents);
    const columns = payload.columns;
    const rows = payload.rows;
    const participantId = payload.participantId;

    if (!Array.isArray(columns) || !Array.isArray(rows) || !participantId) {
      return jsonResponse({ status: "error", message: "Malformed payload." });
    }

    const sheet = getResponsesSheet();
    if (sheet.getLastRow() === 0) sheet.appendRow(columns);

    if (isDuplicateParticipant(sheet, columns, participantId)) {
      return jsonResponse({ status: "duplicate" });
    }

    const values = rows.map(row => columns.map(column => (row[column] !== undefined ? row[column] : "")));
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, columns.length).setValues(values);

    return jsonResponse({ status: "ok", rowsAdded: values.length });
  } catch (err) {
    return jsonResponse({ status: "error", message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return jsonResponse({ status: "ok", message: "SBIV data collection endpoint is running." });
}

function getResponsesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName("Responses") || ss.insertSheet("Responses");
}

function isDuplicateParticipant(sheet, columns, participantId) {
  const idColumnIndex = columns.indexOf("participant_id") + 1;
  const lastRow = sheet.getLastRow();
  if (idColumnIndex < 1 || lastRow < 2) return false;
  const existingIds = sheet.getRange(2, idColumnIndex, lastRow - 1, 1).getValues().flat();
  return existingIds.includes(participantId);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
