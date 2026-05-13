// Paste this entire file into Google Apps Script (Extensions > Apps Script)
// Then: Deploy > New deployment > Web app
//   Execute as: Me
//   Who has access: Anyone
// Copy the Web App URL and paste it into src/config.js

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Itemlist');
  const data = sheet.getDataRange().getValues();
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const barcode = String(data[i][0]).trim();
    const articleCode = String(data[i][1]).trim();
    const description = String(data[i][2]).trim();
    if (barcode || articleCode) items.push({ barcode, articleCode, description });
  }
  return ContentService
    .createTextOutput(JSON.stringify(items))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Itemlist');
  const payload = JSON.parse(e.postData.contents);
  const data = sheet.getDataRange().getValues();
  const identifier = String(payload.barcode).trim();

  let found = false;
  for (let i = 1; i < data.length; i++) {
    const barcode = String(data[i][0]).trim();
    const articleCode = String(data[i][1]).trim();
    if (barcode === identifier || articleCode === identifier) {
      const row = i + 1;
      sheet.getRange(row, 4).setValue(payload.depth);   // D = Depth
      sheet.getRange(row, 5).setValue(payload.width);   // E = Width
      sheet.getRange(row, 6).setValue(payload.height);  // F = Height
      sheet.getRange(row, 7).setValue(payload.weight);  // G = Weight
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow([
      identifier,           // A = Barcode
      '',                   // B = Article Code
      payload.description,  // C = Description
      payload.depth,        // D = Depth
      payload.width,        // E = Width
      payload.height,       // F = Height
      payload.weight,       // G = Weight
    ]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
