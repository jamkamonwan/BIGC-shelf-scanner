// Paste this entire file into Google Apps Script (Extensions > Apps Script)
// Then: Deploy > Manage deployments > pencil > New version > Deploy

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Itemlist');
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Sheet "Itemlist" not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Save mode
    if (e.parameter.action === 'save') {
      const identifier  = String(e.parameter.barcode     || '').trim();
      const description = String(e.parameter.description || '').trim();
      const depth       = parseFloat(e.parameter.depth)    || 0;
      const width       = parseFloat(e.parameter.width)    || 0;
      const height      = parseFloat(e.parameter.height)   || 0;
      const weight      = parseFloat(e.parameter.weight)   || 0;
      const hanger      = e.parameter.hanger === 'true';
      const username    = String(e.parameter.username  || '').trim();
      const pkgDepth    = parseFloat(e.parameter.pkgDepth)  || 0;
      const pkgWidth    = parseFloat(e.parameter.pkgWidth)  || 0;
      const pkgHeight   = parseFloat(e.parameter.pkgHeight) || 0;

      // Strip leading zeros for comparison (handles Sheets stripping them from numeric barcodes)
      const strip0 = (s) => s.replace(/^0+/, '') || s;
      const normId = strip0(identifier);
      const data = sheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < data.length; i++) {
        const barcode     = String(data[i][0]).trim();
        const articleCode = String(data[i][1]).trim();
        if (barcode === identifier || articleCode === identifier ||
            strip0(barcode) === normId || strip0(articleCode) === normId) {
          const row = i + 1;
          sheet.getRange(row, 3).setValue(description);
          sheet.getRange(row, 4).setValue(depth);
          sheet.getRange(row, 5).setValue(width);
          sheet.getRange(row, 6).setValue(height);
          sheet.getRange(row, 7).setValue(weight);
          sheet.getRange(row, 8).setValue(new Date());
          sheet.getRange(row, 9).setValue(hanger);
          sheet.getRange(row, 11).setValue(username);
          sheet.getRange(row, 12).setValue(pkgDepth);
          sheet.getRange(row, 13).setValue(pkgWidth);
          sheet.getRange(row, 14).setValue(pkgHeight);
          sheet.getRange(row, 4, 1, 3).setNumberFormat('0.00');
          sheet.getRange(row, 7).setNumberFormat('0.000');
          sheet.getRange(row, 8).setNumberFormat('dd/mm/yyyy hh:mm');
          sheet.getRange(row, 9).setDataValidation(
            SpreadsheetApp.newDataValidation().requireCheckbox().build()
          );
          sheet.getRange(row, 12, 1, 3).setNumberFormat('0.00');
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow([identifier, '', description, depth, width, height, weight, new Date(), hanger, '', username, pkgDepth, pkgWidth, pkgHeight]);
        const newRow = sheet.getLastRow();
        sheet.getRange(newRow, 1, 1, 2).setNumberFormat('@');
        sheet.getRange(newRow, 4, 1, 3).setNumberFormat('0.00');
        sheet.getRange(newRow, 7).setNumberFormat('0.000');
        sheet.getRange(newRow, 8).setNumberFormat('dd/mm/yyyy hh:mm');
        sheet.getRange(newRow, 9).setDataValidation(
          SpreadsheetApp.newDataValidation().requireCheckbox().build()
        );
        sheet.getRange(newRow, 12, 1, 3).setNumberFormat('0.00');
      }
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, found: found }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // List mode — returns items including existing dimension values
    const data = sheet.getDataRange().getValues();
    const items = [];
    for (let i = 1; i < data.length; i++) {
      const barcode     = String(data[i][0]).trim();
      const articleCode = String(data[i][1]).trim();
      const description = String(data[i][2]).trim();
      const depth       = data[i][3] !== '' ? data[i][3] : '';
      const width       = data[i][4] !== '' ? data[i][4] : '';
      const height      = data[i][5] !== '' ? data[i][5] : '';
      const weight      = data[i][6] !== '' ? data[i][6] : '';
      const hanger      = data[i][8] === true;
      const pkgDepth    = data[i][11] !== '' && data[i][11] !== undefined ? data[i][11] : '';
      const pkgWidth    = data[i][12] !== '' && data[i][12] !== undefined ? data[i][12] : '';
      const pkgHeight   = data[i][13] !== '' && data[i][13] !== undefined ? data[i][13] : '';
      if (barcode || articleCode) {
        items.push({ barcode, articleCode, description, depth, width, height, weight, hanger, pkgDepth, pkgWidth, pkgHeight });
      }
    }
    return ContentService
      .createTextOutput(JSON.stringify(items))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Run this in Apps Script editor to test sheet write
function testSave() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Itemlist');
  if (!sheet) { Logger.log('ERROR: Sheet not found'); return; }
  sheet.appendRow(['TEST_BARCODE', '', 'Test Item', 10, 20, 30, 0.5]);
  Logger.log('SUCCESS');
}
