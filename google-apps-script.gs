const SHEET_NAME = "Catalogo";
const HEADERS = ["id", "isbn", "title", "author", "price", "qty", "cover", "createdAt"];

function getCatalogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0] || ss.insertSheet(SHEET_NAME);
    sheet.setName(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const sheet = getCatalogSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return jsonResponse({ ok: true, books: [] });
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const books = rows
    .filter((r) => r[0] || r[2])
    .map((r) => ({
      id: String(r[0] || ""),
      isbn: String(r[1] || ""),
      title: String(r[2] || ""),
      author: String(r[3] || ""),
      price: Number(r[4]) || 0,
      qty: Number(r[5]) || 0,
      cover: String(r[6] || ""),
      createdAt: Number(r[7]) || Date.now(),
    }));

  return jsonResponse({ ok: true, books });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  const books = Array.isArray(payload.books) ? payload.books : [];

  const sheet = getCatalogSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
  }

  if (books.length > 0) {
    const rows = books.map((b) => [
      b.id || "",
      b.isbn || "",
      b.title || "",
      b.author || "",
      Number(b.price) || 0,
      Number(b.qty) || 0,
      b.cover || "",
      Number(b.createdAt) || Date.now(),
    ]);
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  }

  return jsonResponse({ ok: true, count: books.length });
}
