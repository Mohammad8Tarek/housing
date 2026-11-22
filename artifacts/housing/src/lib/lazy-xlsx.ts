// Lazy loaders for the heavy SheetJS bundles.
//
// `xlsx` (~424kB) and `xlsx-js-style` (~869kB) are only needed the moment a
// user actually triggers an Excel import or export. Importing them statically
// pulls the whole parser/writer into the route chunk, so it downloads on route
// entry even for users who never export. These helpers defer the import to the
// action handler instead; the module is cached after the first call.
//
// Usage:
//   const XLSX = await loadXlsx();
//   const ws = XLSX.utils.json_to_sheet(rows);
// (the enclosing handler must be `async`).

let plainPromise: Promise<typeof import("xlsx")> | null = null;

/** Dynamically load the plain `xlsx` module (cached after first call). */
export function loadXlsx(): Promise<typeof import("xlsx")> {
  if (!plainPromise) plainPromise = import("xlsx");
  return plainPromise;
}

let styledPromise: Promise<typeof import("xlsx-js-style")> | null = null;

/**
 * Dynamically load `xlsx-js-style` (the SheetJS fork whose writer keeps cell
 * styles). Used by the SUNRISE-branded export helpers.
 */
export function loadStyledXlsx(): Promise<typeof import("xlsx-js-style")> {
  if (!styledPromise) styledPromise = import("xlsx-js-style");
  return styledPromise;
}
