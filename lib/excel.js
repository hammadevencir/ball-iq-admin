import * as XLSX from "xlsx";

/**
 * Parse a single worksheet with dynamic columns.
 *
 * - Uses the first non-empty row as the header row.
 * - Preserves column order.
 * - Generates names for blank header cells ("Column N") and de-duplicates
 *   repeated header names ("Name", "Name (2)", ...).
 * - Drops columns that have neither a header nor any data.
 * - Drops fully-empty rows.
 * - Normalizes every remaining row to include ALL kept columns; missing cells
 *   become `null` so every row has a consistent shape.
 *
 * @param {import("xlsx").WorkSheet} worksheet
 * @returns {{ columns: string[], data: Record<string, unknown>[] }}
 */
export function parseSheet(worksheet) {
  // Array-of-arrays keeps blank cells (defval) and skips fully-blank rows.
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  if (!rows.length) return { columns: [], data: [] };

  const headerRow = rows[0] || [];
  const dataRows = rows.slice(1);

  const colCount = Math.max(
    headerRow.length,
    ...dataRows.map((r) => r.length),
    0,
  );

  const isBlank = (v) => v == null || String(v).trim() === "";

  // Raw, trimmed header names by column index.
  const rawHeaders = [];
  for (let i = 0; i < colCount; i++) {
    const h = headerRow[i];
    rawHeaders.push(isBlank(h) ? "" : String(h).trim());
  }

  // Keep a column if it has a header OR any non-empty data cell.
  const keptIndices = [];
  for (let i = 0; i < colCount; i++) {
    const hasHeader = rawHeaders[i] !== "";
    const hasData = dataRows.some((r) => !isBlank(r[i]));
    if (hasHeader || hasData) keptIndices.push(i);
  }

  // Resolve final column names: fill blanks, de-duplicate.
  const columns = [];
  const nameCounts = Object.create(null);
  keptIndices.forEach((i) => {
    let name = rawHeaders[i] || `Column ${i + 1}`;
    if (nameCounts[name] != null) {
      nameCounts[name] += 1;
      name = `${name} (${nameCounts[name]})`;
    } else {
      nameCounts[name] = 1;
    }
    columns.push(name);
  });

  // Build normalized row objects.
  const data = [];
  dataRows.forEach((r) => {
    const allEmpty = keptIndices.every((i) => isBlank(r[i]));
    if (allEmpty) return;
    const obj = {};
    keptIndices.forEach((i, k) => {
      const v = r[i];
      obj[columns[k]] = v === undefined ? null : v;
    });
    data.push(obj);
  });

  return { columns, data };
}

/**
 * Read an Excel/CSV file and parse every sheet with dynamic columns.
 *
 * @param {File} file
 * @returns {Promise<{ sheetName: string, columns: string[], data: Record<string, unknown>[] }[]>}
 */
export function parseExcelAllSheets(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bytes = new Uint8Array(e.target.result);
        const workbook = XLSX.read(bytes, { type: "array" });
        const sheets = workbook.SheetNames.map((sheetName) => {
          const { columns, data } = parseSheet(workbook.Sheets[sheetName]);
          return { sheetName, columns, data };
        });
        resolve(sheets);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
