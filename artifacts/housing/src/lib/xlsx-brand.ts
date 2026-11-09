// SUNRISE-branded Excel styling. Uses xlsx-js-style (a SheetJS fork whose
// writer emits cell styles; plain `xlsx` silently drops them).
import * as XLSX from "xlsx-js-style";

const TEAL = "2AA8AB";
const TEAL_TINT = "E8F6F6";
const RULE = "D9E3E3";
const INK = "1E2A2B";

const thin = { style: "thin", color: { rgb: RULE } } as const;
const border = { top: thin, bottom: thin, left: thin, right: thin };

/**
 * Teal bold header row, light-teal zebra rows, thin rules, and a brand font.
 * Layout (freeze panes, filters, widths) is left to the caller.
 */
export function applySunriseSheetStyle(
  ws: XLSX.WorkSheet,
  opts: { headerRow?: number; rtl?: boolean } = {},
): void {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const headerRow = opts.headerRow ?? range.s.r;
  const align = { horizontal: opts.rtl ? "right" : "left", vertical: "center", wrapText: true };

  for (let r = headerRow; r <= range.e.r; r++) {
    const isHeader = r === headerRow;
    const zebra = !isHeader && (r - headerRow) % 2 === 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] ?? (ws[addr] = { t: "s", v: "" });
      cell.s = isHeader
        ? {
            font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
            fill: { patternType: "solid", fgColor: { rgb: TEAL } },
            alignment: { ...align, horizontal: "center" },
            border,
          }
        : {
            font: { name: "Calibri", sz: 10, color: { rgb: INK } },
            ...(zebra ? { fill: { patternType: "solid", fgColor: { rgb: TEAL_TINT } } } : {}),
            alignment: typeof cell.v === "number" ? { ...align, horizontal: "center" } : align,
            border,
          };
    }
  }

  const rows = ws["!rows"] ?? [];
  rows[headerRow] = { ...(rows[headerRow] ?? {}), hpt: 22 };
  ws["!rows"] = rows;
}

export { XLSX };

/**
 * Style every sheet in the workbook and save it. Rows above the detected
 * header row (e.g. report title / property lines) are styled as teal titles.
 * The header row is the first row filled across most of the sheet's width.
 */
export function writeSunriseWorkbook(
  wb: XLSX.WorkBook,
  filename: string,
  opts: { rtl?: boolean } = {},
): void {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const ref = ws?.["!ref"];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const width = range.e.c - range.s.c + 1;
    let headerRow = range.s.r;
    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 8); r++) {
      let filled = 0;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const v = ws[XLSX.utils.encode_cell({ r, c })]?.v;
        if (v !== undefined && v !== null && String(v).trim() !== "") filled++;
      }
      if (width <= 2 || filled / width >= 0.6) {
        headerRow = r;
        break;
      }
    }
    for (let r = range.s.r; r < headerRow; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) {
          cell.s = {
            font: { name: "Calibri", sz: r === range.s.r ? 14 : 11, bold: r === range.s.r, color: { rgb: r === range.s.r ? TEAL : INK } },
            alignment: { horizontal: opts.rtl ? "right" : "left", vertical: "center" },
          };
        }
      }
    }
    applySunriseSheetStyle(ws, { headerRow, rtl: opts.rtl });
  }
  XLSX.writeFile(wb, filename);
}
