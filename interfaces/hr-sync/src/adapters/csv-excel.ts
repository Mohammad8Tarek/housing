import * as fs from "fs";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const csvParseSync = require("csv-parse/sync");
import * as XLSX from "xlsx";
import * as chokidar from "chokidar";
import { CsvExcelConfig, HousingEmployee, mapFields } from "../config.js";
import { log } from "../logger.js";

function parseFile(filePath: string, cfg: CsvExcelConfig): any[] {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".csv") {
    log.info(`[CSV] Parsing: ${filePath}`);
    const content = fs.readFileSync(filePath, "utf-8");
    const records = csvParseSync.parse(content, {
      columns: cfg.has_header_row ? true : undefined,
      skip_empty_lines: true,
      trim: true,
    });
    log.info(`[CSV] Parsed ${records.length} rows.`);
    return records;
  } else if (ext === ".xlsx" || ext === ".xls") {
    log.info(`[Excel] Parsing: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = cfg.sheet_name || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet)
      throw new Error(`[Excel] Sheet '${sheetName}' not found in file.`);
    const records = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    log.info(
      `[Excel] Parsed ${records.length} rows from sheet '${sheetName}'.`,
    );
    return records;
  } else {
    throw new Error(`[CSV/Excel] Unsupported file format: ${ext}`);
  }
}

export async function fetchFromCsvExcel(
  cfg: CsvExcelConfig,
): Promise<HousingEmployee[]> {
  const filePath = cfg.file_path;
  if (!fs.existsSync(filePath)) {
    throw new Error(`[CSV/Excel] File not found: ${filePath}`);
  }
  const records = parseFile(filePath, cfg);
  return records.map((row: any) =>
    mapFields(row, cfg.field_map),
  ) as HousingEmployee[];
}

export function watchFolder(
  cfg: CsvExcelConfig,
  onNewFile: (employees: HousingEmployee[]) => void,
): void {
  if (!cfg.watch_folder) return;
  const pattern = path.join(cfg.watch_folder, cfg.file_pattern || "*.*");
  log.info(`[CSV/Excel] Watching folder: ${cfg.watch_folder}`);

  chokidar
    .watch(pattern, { ignoreInitial: true, persistent: true })
    .on("add", async (filePath: string) => {
      log.info(`[CSV/Excel] New file detected: ${filePath}`);
      // Wait 1s for file to finish writing
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const records = parseFile(filePath, cfg);
        const employees = records.map((row: any) =>
          mapFields(row, cfg.field_map),
        ) as HousingEmployee[];
        onNewFile(employees);
      } catch (err: any) {
        log.error(`[CSV/Excel] Failed to parse new file: ${err.message}`);
      }
    });
}
