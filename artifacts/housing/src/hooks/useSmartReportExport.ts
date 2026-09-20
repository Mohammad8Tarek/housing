// ════════════════════════════════════════════════════════════
// useSmartReportExport — Smart report export hook
// ════════════════════════════════════════════════════════════
// Returns { exportPdf, exportCsv, exportXlsx } with loading states.
// Uses the jsPDF + AutoTable column type system for PDF,
// formatted CSV with BOM for Excel-compatible Unicode,
// and xlsx library for proper .xlsx workbooks.
// ════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { generateReportPDF } from '@/lib/report/pdfGenerator';
import type { ReportMeta } from '@/lib/report/pdfGenerator';
import type { ReportColumnDef } from '@/lib/report/columnTypes';
import { formatValue } from '@/lib/report/columnTypes';
import { getNestedValue } from '@/lib/report/widthEngine';
import * as XLSX from 'xlsx';

export interface SmartReportExportOptions {
  columns: ReportColumnDef[];
  getData: () => Record<string, unknown>[] | Promise<Record<string, unknown>[]>;
  meta: Omit<ReportMeta, 'generatedBy'>;
  generatedBy?: string;
  language?: 'en' | 'ar';
}

export function useSmartReportExport({
  columns,
  getData,
  meta,
  generatedBy,
  language,
}: SmartReportExportOptions) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileBaseName = meta.title.toLowerCase().replace(/\s+/g, '-');

  // ── Helper: get export columns (filter hiddenInPdf) ──
  const getExportCols = useCallback(() => {
    return columns.filter(c => !c.hiddenInPdf);
  }, [columns]);

  // ── Helper: format a row to string values ──
  const formatRow = useCallback((row: Record<string, unknown>, rowIdx: number, cols: ReportColumnDef[]) => {
    return cols.map(col => {
      if (col.type === 'index') return String(rowIdx + 1);
      const value = getNestedValue(row, col.key);
      if (col.format) return col.format(value, row);
      return formatValue(value, col.type);
    });
  }, []);

  // ── 1. PDF Export ──
  const exportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      const data = await getData();
      generateReportPDF(
        { ...meta, generatedBy },
        columns,
        data,
        language
      );
    } catch (err) {
      console.error('Smart PDF export failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  }, [columns, getData, meta, generatedBy, language]);

  // ── 2. CSV Export ──
  const exportCsv = useCallback(async () => {
    setIsExportingCsv(true);
    try {
      const data = await getData();
      const exportCols = getExportCols();
      const useAr = language === 'ar';
      const headers = exportCols.map(c => (useAr && c.headerAr) ? c.headerAr : c.header).join(',');
      const rows = data.map((row, rowIdx) =>
        formatRow(row, rowIdx, exportCols).map(str => {
          // Escape commas and quotes in CSV
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',')
      );
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileBaseName}-${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Smart CSV export failed:', err);
    } finally {
      setIsExportingCsv(false);
    }
  }, [getData, getExportCols, formatRow, language, fileBaseName, dateStr]);

  // ── 3. XLSX Export ──
  const exportXlsx = useCallback(async () => {
    setIsExportingXlsx(true);
    try {
      const data = await getData();
      const exportCols = getExportCols();
      const useAr = language === 'ar';

      // Build header row
      const headerRow = exportCols.map(c => (useAr && c.headerAr) ? c.headerAr : c.header);

      // Build data rows
      const dataRows = data.map((row, rowIdx) => formatRow(row, rowIdx, exportCols));

      // Create worksheet
      const wsData = [headerRow, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Auto-size columns (approximate widths based on column type)
      ws['!cols'] = exportCols.map(col => {
        switch (col.type) {
          case 'index':      return { wch: 5 };
          case 'id':         return { wch: 14 };
          case 'number':     return { wch: 10 };
          case 'currency':   return { wch: 16 };
          case 'date':       return { wch: 14 };
          case 'datetime':   return { wch: 20 };
          case 'status':     return { wch: 14 };
          case 'boolean':    return { wch: 8 };
          case 'percentage': return { wch: 10 };
          case 'phone':      return { wch: 18 };
          case 'text-short': return { wch: 20 };
          case 'text':       return { wch: 30 };
          default:           return { wch: 15 };
        }
      });

      // Create workbook and save
      const wb = XLSX.utils.book_new();
      const sheetName = meta.title.slice(0, 31); // Excel sheet name max 31 chars
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${fileBaseName}-${dateStr}.xlsx`);
    } catch (err) {
      console.error('Smart XLSX export failed:', err);
    } finally {
      setIsExportingXlsx(false);
    }
  }, [getData, getExportCols, formatRow, language, meta.title, fileBaseName, dateStr]);

  return {
    exportPdf,
    exportCsv,
    exportXlsx,
    isExportingPdf,
    isExportingCsv,
    isExportingXlsx,
  };
}
