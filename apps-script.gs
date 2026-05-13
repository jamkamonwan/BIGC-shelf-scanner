// Paste this entire file into Google Apps Script (Extensions > Apps Script)
// Then: Deploy > New deployment > Web app
//   Execute as: Me
//   Who has access: Anyone
// Copy the Web App URL and paste it into src/config.js

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Itemlist');

  // Save mode — triggered when app sends ?action=save&...
  if (e.parameter.action === 'save') {
    const identifier = String(e.parameter.barcode || '').trim();
    const description = String(e.parameter.description || '').trim();
    const depth  = parseFloat(e.parameter.depth)  || 0;
    const width  = parseFloat(e.parameter.width)  || 0;
    const height = parseFloat(e.parameter.height) || 0;
    const weight = parseFloat(e.parameter.weight) || 0;

    const data = sheet.getDataRange().getValues();
    let found = false;

    for (let i = 1; i < data.length; i++) {
      const barcode     = String(data[i][0]).trim();
      const articleCode = String(data[i][1]).trim();
      if (barcode === identifier || articleCode === identifier) {
        const row = i + 1;
        sheet.getRange(row, 4).setValue(depth);
        sheet.getRange(row, 5).setValue(width);
        sheet.getRange(row, 6).setValue(height);
        sheet.getRange(row, 7).setValue(weight);
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([identifier, '', description, depth, width, height, weight]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // List mode — return all items for validation
  const data = sheet.getDataRange().getValues();
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const barcode     = String(data[i][0]).trim();
    const articleCode = String(data[i][1]).trim();
    const description = String(data[i][2]).trim();
    if (barcode || articleCode) items.push({ barcode, articleCode, description });
  }
  return ContentService
    .createTextOutput(JSON.stringify(items))
    .setMimeType(ContentService.MimeType.JSON);
}
