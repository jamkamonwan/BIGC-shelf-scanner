// Paste this entire file into Google Apps Script (Extensions > Apps Script)
// Then: Deploy > Manage deployments > pencil > New version > Deploy
//
// Sheet column layout (Itemlist tab):
// A(1)=Division   B(2)=Department   C(3)=Class
// D(4)=Barcode    E(5)=Description
// F(6)=ProdDepth  G(7)=ProdWidth    H(8)=ProdHeight   I(9)=NetWeight
// J(10)=DateTime  K(11)=Hanger      L(12)=Remark(legacy)  M(13)=Username(legacy)
// N(14)=PkgDepth  O(15)=PkgWidth    P(16)=PkgHeight
// Q(17)=DimUsername   R(18)=WeightUsername

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
      const identifier    = String(e.parameter.barcode       || '').trim();
      const description   = String(e.parameter.description   || '').trim();
      const depth         = parseFloat(e.parameter.depth)    || 0;
      const width         = parseFloat(e.parameter.width)    || 0;
      const height        = parseFloat(e.parameter.height)   || 0;
      const weight        = parseFloat(e.parameter.weight)   || 0;
      const hanger        = e.parameter.hanger === 'true';
      const pkgDepth      = parseFloat(e.parameter.pkgDepth)      || 0;
      const pkgWidth      = parseFloat(e.parameter.pkgWidth)      || 0;
      const pkgHeight     = parseFloat(e.parameter.pkgHeight)     || 0;
      const dimUsername    = String(e.parameter.dimUsername    || '').trim();
      const weightUsername = String(e.parameter.weightUsername || '').trim();

      const strip0 = (s) => s.replace(/^0+/, '') || s;
      const normId = strip0(identifier);
      const data = sheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < data.length; i++) {
        const barcode = String(data[i][3]).trim(); // col D
        if (barcode === identifier || strip0(barcode) === normId) {
          const row = i + 1;
          sheet.getRange(row, 5).setValue(description);   // E: Description
          sheet.getRange(row, 6).setValue(depth);          // F: ProdDepth
          sheet.getRange(row, 7).setValue(width);          // G: ProdWidth
          sheet.getRange(row, 8).setValue(height);         // H: ProdHeight
          sheet.getRange(row, 9).setValue(weight);         // I: NetWeight
          sheet.getRange(row, 10).setValue(new Date());    // J: DateTime
          sheet.getRange(row, 11).setValue(hanger);        // K: Hanger
          sheet.getRange(row, 14).setValue(pkgDepth);      // N: PkgDepth
          sheet.getRange(row, 15).setValue(pkgWidth);      // O: PkgWidth
          sheet.getRange(row, 16).setValue(pkgHeight);     // P: PkgHeight
          // Only overwrite username columns if non-empty (don't erase the other person's name)
          if (dimUsername)    sheet.getRange(row, 13).setValue(dimUsername);   // M: legacy
          if (dimUsername)    sheet.getRange(row, 17).setValue(dimUsername);   // Q: DimUsername
          if (weightUsername) sheet.getRange(row, 18).setValue(weightUsername); // R: WeightUsername
          sheet.getRange(row, 6, 1, 3).setNumberFormat('0.00');       // F-H
          sheet.getRange(row, 9).setNumberFormat('0.000');             // I
          sheet.getRange(row, 10).setNumberFormat('dd/mm/yyyy hh:mm'); // J
          sheet.getRange(row, 11).setDataValidation(
            SpreadsheetApp.newDataValidation().requireCheckbox().build()
          );
          sheet.getRange(row, 14, 1, 3).setNumberFormat('0.00');      // N-P
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow(['', '', '', identifier, description, depth, width, height, weight, new Date(), hanger, '', dimUsername, pkgDepth, pkgWidth, pkgHeight, dimUsername, weightUsername]);
        const newRow = sheet.getLastRow();
        sheet.getRange(newRow, 4).setNumberFormat('@');                 // D: barcode
        sheet.getRange(newRow, 6, 1, 3).setNumberFormat('0.00');       // F-H
        sheet.getRange(newRow, 9).setNumberFormat('0.000');             // I
        sheet.getRange(newRow, 10).setNumberFormat('dd/mm/yyyy hh:mm'); // J
        sheet.getRange(newRow, 11).setDataValidation(
          SpreadsheetApp.newDataValidation().requireCheckbox().build()
        );
        sheet.getRange(newRow, 14, 1, 3).setNumberFormat('0.00');      // N-P
      }
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, found: found }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // List mode
    const data = sheet.getDataRange().getValues();
    const items = [];
    for (let i = 1; i < data.length; i++) {
      const division    = String(data[i][0]).trim();  // A
      const department  = String(data[i][1]).trim();  // B
      const cls         = String(data[i][2]).trim();  // C
      const barcode     = String(data[i][3]).trim();  // D
      const description = String(data[i][4]).trim();  // E
      const depth       = data[i][5]  !== '' ? data[i][5]  : ''; // F
      const width       = data[i][6]  !== '' ? data[i][6]  : ''; // G
      const height      = data[i][7]  !== '' ? data[i][7]  : ''; // H
      const weight      = data[i][8]  !== '' ? data[i][8]  : ''; // I
      const hanger      = data[i][10] === true;                   // K
      const pkgDepth    = data[i][13] !== '' && data[i][13] !== undefined ? data[i][13] : ''; // N
      const pkgWidth    = data[i][14] !== '' && data[i][14] !== undefined ? data[i][14] : ''; // O
      const pkgHeight   = data[i][15] !== '' && data[i][15] !== undefined ? data[i][15] : ''; // P
      const dimUsername    = data[i][16] !== undefined ? String(data[i][16]).trim() : ''; // Q
      const weightUsername = data[i][17] !== undefined ? String(data[i][17]).trim() : ''; // R
      if (barcode) {
        items.push({ division, department, cls, barcode, description, depth, width, height, weight, hanger, pkgDepth, pkgWidth, pkgHeight, dimUsername, weightUsername });
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
  sheet.appendRow(['', '', '', 'TEST_BARCODE', 'Test Item', 10, 20, 30, 0.5]);
  Logger.log('SUCCESS');
}
