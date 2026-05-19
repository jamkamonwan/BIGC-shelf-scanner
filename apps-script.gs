// Paste this entire file into Google Apps Script (Extensions > Apps Script)
// Then: Deploy > Manage deployments > pencil > New version > Deploy
//
// Sheet column layout (Itemlist tab):
// A(1)=Division  B(2)=Department  C(3)=Class
// D(4)=Barcode   E(5)=ArticleCode  F(6)=Description
// G(7)=ProdDepth H(8)=ProdWidth   I(9)=ProdHeight  J(10)=NetWeight
// K(11)=DateTime  L(12)=Hanger    M(13)=Remark(legacy)  N(14)=Username
// O(15)=PkgDepth  P(16)=PkgWidth  Q(17)=PkgHeight

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

      const strip0 = (s) => s.replace(/^0+/, '') || s;
      const normId = strip0(identifier);
      const data = sheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < data.length; i++) {
        const barcode     = String(data[i][3]).trim(); // col D
        const articleCode = String(data[i][4]).trim(); // col E
        if (barcode === identifier || articleCode === identifier ||
            strip0(barcode) === normId || strip0(articleCode) === normId) {
          const row = i + 1;
          sheet.getRange(row, 6).setValue(description);   // F: Description
          sheet.getRange(row, 7).setValue(depth);          // G: ProdDepth
          sheet.getRange(row, 8).setValue(width);          // H: ProdWidth
          sheet.getRange(row, 9).setValue(height);         // I: ProdHeight
          sheet.getRange(row, 10).setValue(weight);        // J: NetWeight
          sheet.getRange(row, 11).setValue(new Date());    // K: DateTime
          sheet.getRange(row, 12).setValue(hanger);        // L: Hanger
          sheet.getRange(row, 14).setValue(username);      // N: Username
          sheet.getRange(row, 15).setValue(pkgDepth);      // O: PkgDepth
          sheet.getRange(row, 16).setValue(pkgWidth);      // P: PkgWidth
          sheet.getRange(row, 17).setValue(pkgHeight);     // Q: PkgHeight
          sheet.getRange(row, 7, 1, 3).setNumberFormat('0.00');   // G-I
          sheet.getRange(row, 10).setNumberFormat('0.000');        // J
          sheet.getRange(row, 11).setNumberFormat('dd/mm/yyyy hh:mm'); // K
          sheet.getRange(row, 12).setDataValidation(
            SpreadsheetApp.newDataValidation().requireCheckbox().build()
          );
          sheet.getRange(row, 15, 1, 3).setNumberFormat('0.00');  // O-Q
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow(['', '', '', identifier, '', description, depth, width, height, weight, new Date(), hanger, '', username, pkgDepth, pkgWidth, pkgHeight]);
        const newRow = sheet.getLastRow();
        sheet.getRange(newRow, 4, 1, 2).setNumberFormat('@');       // D-E: barcode/articleCode
        sheet.getRange(newRow, 7, 1, 3).setNumberFormat('0.00');    // G-I
        sheet.getRange(newRow, 10).setNumberFormat('0.000');         // J
        sheet.getRange(newRow, 11).setNumberFormat('dd/mm/yyyy hh:mm'); // K
        sheet.getRange(newRow, 12).setDataValidation(
          SpreadsheetApp.newDataValidation().requireCheckbox().build()
        );
        sheet.getRange(newRow, 15, 1, 3).setNumberFormat('0.00');   // O-Q
      }
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, found: found }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // List mode
    const data = sheet.getDataRange().getValues();
    const items = [];
    for (let i = 1; i < data.length; i++) {
      const division    = String(data[i][0]).trim();   // A
      const department  = String(data[i][1]).trim();   // B
      const cls         = String(data[i][2]).trim();   // C
      const barcode     = String(data[i][3]).trim();   // D
      const articleCode = String(data[i][4]).trim();   // E
      const description = String(data[i][5]).trim();   // F
      const depth       = data[i][6]  !== '' ? data[i][6]  : ''; // G
      const width       = data[i][7]  !== '' ? data[i][7]  : ''; // H
      const height      = data[i][8]  !== '' ? data[i][8]  : ''; // I
      const weight      = data[i][9]  !== '' ? data[i][9]  : ''; // J
      const hanger      = data[i][11] === true;                   // L
      const pkgDepth    = data[i][14] !== '' && data[i][14] !== undefined ? data[i][14] : ''; // O
      const pkgWidth    = data[i][15] !== '' && data[i][15] !== undefined ? data[i][15] : ''; // P
      const pkgHeight   = data[i][16] !== '' && data[i][16] !== undefined ? data[i][16] : ''; // Q
      if (barcode || articleCode) {
        items.push({ division, department, cls, barcode, articleCode, description, depth, width, height, weight, hanger, pkgDepth, pkgWidth, pkgHeight });
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

function testSave() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Itemlist');
  if (!sheet) { Logger.log('ERROR: Sheet not found'); return; }
  sheet.appendRow(['', '', '', 'TEST_BARCODE', '', 'Test Item', 10, 20, 30, 0.5]);
  Logger.log('SUCCESS');
}
