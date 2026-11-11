// Full HTML document (styles, print controls, page markup) for printLuxuryReport.
// Moved verbatim from luxury-report-engine.ts; the engine computes the values and passes them in.
import { escapeHtml } from "@/lib/html-escape";
import type { ReportKpiCard } from "./report-types";

export interface ReportDocumentParams {
  allPagesHtml: string;
  autoPrint: boolean;
  baseFontSizePt: number;
  cellPadding: string;
  customSectionsHtml: string | undefined;
  dir: string;
  initialShowKpis: boolean;
  initialShowSigs: boolean;
  isArabic: boolean;
  kpiCards: ReportKpiCard[];
  lang: string;
  operaCode: string;
  orientation: string;
  printFontSizePt: number;
  printPadding: string;
  propName: string;
  reportTitle: string;
  seqWidthPct: number;
  tableLetterSpacing: string;
  tableLineHeight: string;
  tableRows: any[][];
  totalPages: number;
}

export function buildReportDocumentHtml(p: ReportDocumentParams): string {
  const {
    allPagesHtml,
    autoPrint,
    baseFontSizePt,
    cellPadding,
    customSectionsHtml,
    dir,
    initialShowKpis,
    initialShowSigs,
    isArabic,
    kpiCards,
    lang,
    operaCode,
    orientation,
    printFontSizePt,
    printPadding,
    propName,
    reportTitle,
    seqWidthPct,
    tableLetterSpacing,
    tableLineHeight,
    tableRows,
    totalPages,
  } = p;
  return `<!DOCTYPE html>
<html class="notranslate" lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="google" content="notranslate" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(reportTitle)} — ${escapeHtml(propName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4 ${orientation};
      margin: 8mm 10mm;
      marks: none;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: ${isArabic ? "'Cairo', Tahoma, Arial, sans-serif" : "Arial, Helvetica, 'Nimbus Sans L', sans-serif"};
      direction: ${dir};
      background: #f1f5f9;
      color: #000000;
      font-size: ${baseFontSizePt}pt;
      line-height: 1.35;
      -webkit-font-smoothing: antialiased;
    }

    /* Floating Interactive Preview Bar */
    .preview-actions-bar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.18);
    }
    .bar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .bar-title {
      font-weight: 800;
      font-size: 11pt;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .bar-meta {
      font-size: 8pt;
      color: #94a3b8;
      background: rgba(255,255,255,0.08);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .bar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      padding: 6px 14px;
      font-size: 8.5pt;
      font-weight: 700;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .btn-primary {
      background: #0284c7;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(2,132,199,0.35);
    }
    .btn-primary:hover {
      background: #0369a1;
      transform: translateY(-1px);
    }
    .btn-outline {
      background: rgba(255,255,255,0.1);
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .btn-outline:hover {
      background: rgba(255,255,255,0.2);
    }
    .btn-close {
      background: rgba(239,68,68,0.2);
      color: #fca5a5;
      border: 1px solid rgba(239,68,68,0.4);
    }
    .btn-close:hover {
      background: rgba(239,68,68,0.35);
      color: #ffffff;
    }

    /* Sheet Canvas & Multi-page Preview */
    .sheet-wrapper {
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      background: #475569;
      width: 100%;
      box-sizing: border-box;
      overflow-x: auto;
    }
    .sheet.opera-page {
      width: ${orientation === "landscape" ? "297mm" : "210mm"};
      max-width: ${orientation === "landscape" ? "297mm" : "210mm"};
      min-height: ${orientation === "landscape" ? "210mm" : "297mm"};
      height: ${tableRows.length === 0 && customSectionsHtml ? "auto" : orientation === "landscape" ? "210mm" : "297mm"};
      max-height: ${tableRows.length === 0 && customSectionsHtml ? "none" : orientation === "landscape" ? "210mm" : "297mm"};
      background: #ffffff;
      padding: 4mm 6mm;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      position: relative;
      box-sizing: border-box;
      overflow: ${tableRows.length === 0 && customSectionsHtml ? "visible" : "hidden"};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .opera-page-main {
      width: 100%;
      display: flex;
      flex-direction: column;
      flex: 0 0 auto;
      overflow: visible;
    }
    .opera-page-bottom {
      width: 100%;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      margin-top: auto;
    }

    /* Formal PDF Header: system logo left, property logo right (strictly direction: ltr so never flips in Arabic RTL) */
    .opera-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
      min-height: 28px;
      direction: ltr !important;
    }
    .opera-header-left {
      width: 25%;
      min-width: 100px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      direction: ltr !important;
      text-align: left !important;
    }
    .opera-header-center {
      width: 50%;
      text-align: center !important;
      padding: 0 10px;
      align-self: center;
    }
    .opera-hotel-name {
      font-size: 8.5pt;
      font-weight: 700;
      color: #334155;
      margin-bottom: 1px;
      letter-spacing: 0.2px;
      line-height: 1.1;
    }
    .opera-report-title {
      font-size: 11pt !important;
      font-weight: 800 !important;
      color: #0f2a44 !important;
      letter-spacing: 0.2px;
      line-height: 1.15;
    }
    .opera-report-submeta {
      font-size: 7pt;
      color: #475569;
      margin-top: 1px;
    }
    .opera-header-right {
      width: 25%;
      min-width: 100px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      direction: ltr !important;
      text-align: right !important;
    }
    .opera-sub-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
      min-height: 20px;
      direction: ltr !important;
      padding: 0 2px;
    }
    .opera-sub-header-left {
      font-size: 9pt;
      font-weight: 800;
      color: #000000;
      display: flex;
      align-items: center;
      gap: 8px;
      direction: ltr !important;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .sub-prop-title {
      font-family: Georgia, "Times New Roman", serif;
      font-style: italic;
    }
    .sub-sep {
      color: #64748b;
    }
    .sub-rep-title {
      font-weight: 800;
    }
    .opera-sub-header-right {
      font-size: 7pt;
      font-family: "Courier New", monospace;
      font-weight: 700;
      color: #000000;
      direction: ltr !important;
      text-align: right !important;
      flex-shrink: 0;
      white-space: nowrap;
      padding-left: 8px;
    }
    .opera-logo {
      max-height: 26px;
      max-width: 110px;
      object-fit: contain;
    }
    .opera-syslogo {
      max-width: 110px;
      max-height: 26px;
    }
    .opera-proplogo {
      max-width: 90px;
      max-height: 26px;
    }
    .opera-meta-datetime {
      font-size: 6.8pt;
      font-weight: 800;
      color: #000000;
      font-family: "Courier New", monospace;
      margin-top: 1px;
      letter-spacing: 0.2px;
    }
    .opera-meta-sep {
      margin: 0 8px;
      color: #000000;
    }
    .opera-fallback-brand {
      font-weight: 900;
      color: #000000;
      font-size: 11pt;
      letter-spacing: 0.5px;
      line-height: 1.15;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    .opera-fallback-brand.right-brand {
      align-items: flex-end;
      text-align: right;
    }
    .opera-fallback-badge {
      font-size: 6.8pt;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.8px;
    }

    .opera-divider {
      height: 0;
      background: transparent;
      margin: 2px 0 8px 0;
    }

    /* Opera Data Table: Strict fixed layout guarantees zero page blowout */
    table.opera-table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      margin-bottom: 0 !important;
      height: auto !important;
      font-size: ${baseFontSizePt}pt;
      table-layout: fixed !important;
      word-wrap: break-word !important;
    }
    col.opera-col-seq,
    table.opera-table th.opera-seq-col,
    table.opera-table td.opera-seq-col,
    table.opera-table th:first-child,
    table.opera-table td:first-child {
      width: ${seqWidthPct}% !important;
      max-width: 32px !important;
      min-width: 18px !important;
      text-align: center !important;
      padding-left: 2px !important;
      padding-right: 2px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
    }
    table.opera-table th {
      background: #f8fafc !important;
      color: #000000 !important;
      font-weight: 800 !important;
      font-size: ${Math.max(5.0, baseFontSizePt - 0.2)}pt !important;
      border-top: 1.5px solid #000000 !important;
      border-bottom: 1.5px solid #000000 !important;
      border-left: none !important;
      border-right: none !important;
      border-inline-end: 1px solid #e2e8f0 !important;
      padding: ${cellPadding} !important;
      line-height: 1.15;
      vertical-align: bottom;
      overflow: visible !important;
      text-overflow: clip !important;
      white-space: normal !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      box-sizing: border-box !important;
      letter-spacing: ${tableLetterSpacing};
      hyphens: auto !important;
    }
    table.opera-table th:last-child {
      border-inline-end: none !important;
    }
    table.opera-table td {
      background: #ffffff !important;
      color: #000000 !important;
      font-weight: 800 !important;
      overflow: hidden !important;
      overflow-wrap: anywhere !important;
      word-break: normal;
      border-top: none !important;
      border-left: none !important;
      border-right: none !important;
      border-inline-end: 1px solid #f1f5f9 !important;
      border-bottom: 1px solid #cbd5e1 !important;
      padding: ${cellPadding} !important;
      line-height: ${tableLineHeight} !important;
      vertical-align: middle;
      overflow: hidden !important;
      text-overflow: clip !important;
      word-break: normal;
      overflow-wrap: anywhere !important;
      box-sizing: border-box !important;
      letter-spacing: ${tableLetterSpacing};
      hyphens: none !important;
      -webkit-font-smoothing: antialiased;
    }
    table.opera-table td:last-child {
      border-inline-end: none !important;
    }
    tr.opera-totals-row td {
      border-top: 1.5px solid #000000 !important;
      border-bottom: 2px solid #000000 !important;
      font-weight: 800 !important;
      font-size: ${baseFontSizePt}pt !important;
      background: #f8fafc !important;
      color: #000000 !important;
      padding: 5px 6px !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }

    /* KPI Summary Cards */
    .kpi-grid {
      display: grid;
      gap: 10px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .kpi-card {
      padding: 8px 10px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: #0f172a;
    }
    .kpi-card.green::before { background: #16a34a; }
    .kpi-card.blue::before { background: #2563eb; }
    .kpi-card.orange::before { background: #ea580c; }
    .kpi-card.red::before { background: #dc2626; }
    .kpi-val {
      font-size: 14pt;
      font-weight: 800;
      color: #000000;
      margin-top: 2px;
    }
    .kpi-label {
      font-size: 7.5pt;
      font-weight: 600;
      color: #475569;
    }
    .kpi-subtext {
      font-size: 6.8pt;
      color: #64748b;
    }

    /* Signatures Block */
    /* Signatures Block */
    .sig-section {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1.5px dashed #cbd5e1;
      page-break-inside: avoid;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }
    .sig-card {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #f8fafc;
      text-align: center;
      min-height: 80px;
    }
    .sig-role {
      font-weight: 800;
      font-size: 8.5pt;
      color: #0F2A44;
      margin-bottom: 30px;
    }
    .sig-line {
      border-top: 1.5px dashed #94a3b8;
      margin: 0 10px 4px;
    }
    .sig-date {
      font-size: 7.2pt;
      font-weight: 600;
      color: #64748b;
    }

    /* Opera Footer Layout - Clean single line */
    .opera-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.2pt;
      color: #334155;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid #cbd5e1;
      line-height: 1.2;
      direction: ltr !important;
    }
    .opera-footer-left {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      color: #000000;
      font-size: 7.2pt;
      max-width: 65%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .opera-filter-tag {
      font-weight: 700;
      color: #000000;
      font-size: 7.2pt;
      white-space: nowrap;
    }
    .opera-filter-desc-inline {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #334155;
      font-weight: 600;
      font-size: 7pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .opera-meta-sep {
      color: #94a3b8;
      font-weight: 800;
      padding: 0 1px;
    }
    .opera-footer-center {
      text-align: center;
      font-weight: 800;
      color: #000000;
      font-size: 7.5pt;
    }
    .opera-footer-right {
      display: flex;
      align-items: center;
      font-family: "Courier New", monospace;
      font-weight: 700;
      color: #334155;
      font-size: 7pt;
    }

    /* Print Media Styles */
    @media print {
      @page {
        size: A4 ${orientation};
        margin: 8mm 10mm !important;
        marks: none;
      }
      html, body {
        width: 100% !important;
        height: auto !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-size: ${printFontSizePt}pt !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .preview-actions-bar { display: none !important; }
      .sheet-wrapper {
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        background: transparent !important;
        display: block !important;
        gap: 0 !important;
      }
      .sheet.opera-page {
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        max-height: none !important;
        min-height: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        border-radius: 0 !important;
        display: block !important;
        page-break-after: auto !important;
        break-after: auto !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
        box-sizing: border-box !important;
      }
      .sheet.opera-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .opera-page-main {
        width: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        flex: 0 0 auto !important;
      }
      .opera-page-bottom {
        width: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        flex-shrink: 0 !important;
        margin-top: auto !important;
      }
      table.opera-table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed !important;
        height: auto !important;
        font-size: ${printFontSizePt}pt !important;
        border-collapse: collapse !important;
        margin-bottom: 0 !important;
      }
      col.opera-col-seq,
      table.opera-table th.opera-seq-col,
      table.opera-table td.opera-seq-col,
      table.opera-table th:first-child,
      table.opera-table td:first-child {
        width: ${seqWidthPct}% !important;
        max-width: 28px !important;
        min-width: 16px !important;
        text-align: center !important;
        padding-left: 1px !important;
        padding-right: 1px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }
    table.opera-table tr.opera-row {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    table.opera-table th {
        font-size: ${Math.max(5.0, printFontSizePt - 0.2)}pt !important;
        font-weight: 800 !important;
        padding: ${printPadding} !important;
        border-top: 1.5px solid #000000 !important;
        border-bottom: 1.5px solid #000000 !important;
        background: #f1f5f9 !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        white-space: normal !important;
        overflow: visible !important;
        hyphens: auto !important;
      }
      table.opera-table td {
        font-size: ${printFontSizePt}pt !important;
        font-weight: 700 !important;
        padding: ${printPadding} !important;
        line-height: ${tableLineHeight} !important;
        color: #000000 !important;
        border-bottom: 1px solid #cbd5e1 !important;
        word-break: normal !important;
        overflow-wrap: break-word !important;
        overflow: visible !important;
        text-overflow: clip !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Prevent internal breaks inside rows */
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      tbody tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      thead {
        display: table-header-group !important;
        break-inside: avoid !important;
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      /* Display dynamic Opera page indicator */
      .opera-page-indicator {
        display: inline-block !important;
        font-weight: 600 !important;
      }
      /* Keep signatures and footer intact */
      .sig-section {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-top: 8px !important;
        padding-top: 6px !important;
      }
      .sig-role {
        margin-bottom: 24px !important;
      }
      .opera-footer {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-top: auto !important;
        padding-top: 4px !important;
        border-top: 1px solid #cbd5e1 !important;
        direction: ltr !important;
        width: 100% !important;
      }
      .opera-footer-left {
        max-width: 65% !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }
      .opera-filter-desc-inline {
        white-space: nowrap !important;
        overflow: hidden !important;
      }
      .kpi-grid {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .opera-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        direction: ltr !important;
      }
      .opera-header-left {
        width: 25% !important;
        min-width: 140px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        direction: ltr !important;
        text-align: left !important;
      }
      .opera-header-right {
        width: 25% !important;
        min-width: 140px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
        justify-content: flex-start !important;
        direction: ltr !important;
        text-align: right !important;
      }
      .opera-sub-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        direction: ltr !important;
        padding: 0 2px !important;
        min-height: 22px !important;
      }
      .opera-sub-header-left {
        display: flex !important;
        align-items: center !important;
        font-size: 9.5pt !important;
        font-weight: 800 !important;
        color: #000000 !important;
        direction: ltr !important;
      }
      .opera-sub-header-right {
        font-size: 7.2pt !important;
        font-family: "Courier New", monospace !important;
        font-weight: 700 !important;
        color: #000000 !important;
        direction: ltr !important;
      }
      .opera-logo {
        object-fit: contain !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        display: block !important;
      }
      .opera-syslogo {
        max-width: 160px !important;
        max-height: 48px !important;
      }
      .opera-proplogo {
        max-width: 130px !important;
        max-height: 44px !important;
      }
    }
  </style>
</head>
<body>

  <!-- Floating Preview Actions Bar -->
  <div class="preview-actions-bar">
    <div class="bar-left">
      <div class="bar-title">
        <span>🏨</span>
        <span>${escapeHtml(reportTitle)}</span>
      </div>
      <div class="bar-meta">${escapeHtml(propName)} · ${tableRows.length} ${isArabic ? "سجل" : "records"} · ${totalPages} ${isArabic ? (totalPages === 1 ? "صفحة" : "صفحات") : totalPages === 1 ? "page" : "pages"} · <span id="metaOrient">${orientation === "landscape" ? (isArabic ? "أفقي (Landscape)" : "Landscape") : isArabic ? "رأسي (Portrait)" : "Portrait"}</span> · <span style="font-family: monospace;">[${operaCode}]</span></div>
    </div>
    <div class="bar-actions">
      <button class="btn btn-primary" onclick="window.print()">🖨️ ${isArabic ? "طباعة / حفظ كـ PDF" : "Print / Save as PDF"}</button>
      <button class="btn btn-outline" id="orientBtn" onclick="toggleOrientation()">📄 ${isArabic ? (orientation === "landscape" ? "أفقي (انقر للرأسي)" : "رأسي (انقر للأفقي)") : orientation === "landscape" ? "Landscape (Click for Portrait)" : "Portrait (Click for Landscape)"}</button>
      ${
        kpiCards.length > 0
          ? `
      <button class="btn btn-outline" id="kpiToggleBtn" onclick="toggleKpis()">
        📊 ${isArabic ? (initialShowKpis ? "الإحصائيات: ظاهرة" : "الإحصائيات: مخفية") : initialShowKpis ? "KPIs: Shown" : "KPIs: Hidden"}
      </button>`
          : ""
      }
      <button class="btn btn-outline" id="sigToggleBtn" onclick="toggleSignatures()">
        ✍️ ${isArabic ? (initialShowSigs ? "التوقيعات: ظاهرة" : "التوقيعات: مخفية") : initialShowSigs ? "Signatures: Shown" : "Signatures: Hidden"}
      </button>
      <button class="btn btn-close" onclick="window.close()">❌ ${isArabic ? "إغلاق" : "Close"}</button>
    </div>
  </div>

  <div class="sheet-wrapper" id="sheetWrapper">
    ${allPagesHtml}
  </div>

  <script>
    let currentOrientation = "${orientation}";
    function toggleOrientation() {
      const sheets = document.querySelectorAll(".sheet.opera-page");
      const orientBtn = document.getElementById("orientBtn");
      const metaOrient = document.getElementById("metaOrient");
      currentOrientation = currentOrientation === "landscape" ? "portrait" : "landscape";
      sheets.forEach(function(sheet) {
        if (currentOrientation === "portrait") {
          sheet.style.width = "210mm";
          sheet.style.maxWidth = "210mm";
          sheet.style.height = "297mm";
          sheet.style.maxHeight = "297mm";
        } else {
          sheet.style.width = "297mm";
          sheet.style.maxWidth = "297mm";
          sheet.style.height = "210mm";
          sheet.style.maxHeight = "210mm";
        }
      });
      if (orientBtn) {
        orientBtn.innerHTML = currentOrientation === "portrait"
          ? "📄 ${isArabic ? "رأسي (انقر للأفقي)" : "Portrait (Click for Landscape)"}"
          : "📄 ${isArabic ? "أفقي (انقر للرأسي)" : "Landscape (Click for Portrait)"}";
      }
      if (metaOrient) {
        metaOrient.innerHTML = currentOrientation === "portrait"
          ? "${isArabic ? "رأسي (Portrait)" : "Portrait"}"
          : "${isArabic ? "أفقي (Landscape)" : "Landscape"}";
      }
      const existingStyle = document.getElementById("dynamicPageOrientation");
      if (existingStyle) existingStyle.remove();
      const styleEl = document.createElement("style");
      styleEl.id = "dynamicPageOrientation";
      styleEl.innerHTML = "@page { size: A4 " + currentOrientation + " !important; margin: 8mm 10mm !important; marks: none; }";
      document.head.appendChild(styleEl);
    }

    let kpisVisible = ${initialShowKpis ? "true" : "false"};
    function toggleKpis() {
      const grid = document.getElementById("kpiGrid");
      const btn = document.getElementById("kpiToggleBtn");
      if (!grid) return;
      kpisVisible = !kpisVisible;
      if (kpisVisible) {
        grid.style.removeProperty("display");
        if (btn) btn.innerHTML = "📊 ${isArabic ? "الإحصائيات: ظاهرة" : "KPIs: Shown"}";
      } else {
        grid.style.setProperty("display", "none", "important");
        if (btn) btn.innerHTML = "📊 ${isArabic ? "الإحصائيات: مخفية" : "KPIs: Hidden"}";
      }
    }

    let sigsVisible = ${initialShowSigs ? "true" : "false"};
    function toggleSignatures() {
      const sec = document.getElementById("sigSection");
      const btn = document.getElementById("sigToggleBtn");
      if (!sec) return;
      sigsVisible = !sigsVisible;
      if (sigsVisible) {
        sec.style.removeProperty("display");
        if (btn) btn.innerHTML = "✍️ ${isArabic ? "التوقيعات: ظاهرة" : "Signatures: Shown"}";
      } else {
        sec.style.setProperty("display", "none", "important");
        if (btn) btn.innerHTML = "✍️ ${isArabic ? "التوقيعات: مخفية" : "Signatures: Hidden"}";
      }
    }

    const reportFullDocTitle = document.title;
    window.onbeforeprint = function() {
      document.title = "";
    };
    window.onafterprint = function() {
      document.title = reportFullDocTitle;
    };

    ${
      autoPrint
        ? `
    function triggerPrintWhenReady() {
      const imgs = Array.from(document.images);
      const imgPromises = imgs.map(function(img) {
        if (img.complete) return Promise.resolve();
        return new Promise(function(resolve) {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      Promise.all([document.fonts.ready, ...imgPromises]).then(function() {
        setTimeout(function() {
          window.print();
        }, 350);
      });
    }
    if (document.readyState === "complete") {
      triggerPrintWhenReady();
    } else {
      window.addEventListener("load", triggerPrintWhenReady);
    }
    `
        : ""
    }
  </script>
</body>
</html>`;
}
