import React, { forwardRef } from "react";
import { formatDate } from "@/lib/date-utils";
import {
  SR,
  SR_FONT_ARABIC,
  SR_FONT_PRINT,
  SR_LOGO_TEAL,
  srStatusTone,
} from "@/lib/sunrise-brand";

export interface ReportColumnConfig {
  key: string;
  header: string;
  headerAr?: string;
  type?: "text" | "number" | "date" | "status" | "badge" | "index";
  align?: "left" | "center" | "right";
  width?: string;
}

export interface ReportKpiItem {
  label: string;
  labelAr?: string;
  value: string | number;
  sublabel?: string;
  sublabelAr?: string;
  color?: "blue" | "emerald" | "amber" | "rose" | "slate" | "purple";
}

export interface PrintableReportDocumentProps {
  title: string;
  titleAr?: string;
  subtitle?: string;
  subtitleAr?: string;
  propertyName?: string;
  propertyCode?: string;
  systemLogoUrl?: string;
  propertyLogoUrl?: string;
  generatedBy?: string;
  generatedAt?: Date | string;
  filtersSummary?: Record<string, string>;
  kpis?: ReportKpiItem[];
  columns: ReportColumnConfig[];
  rows: Record<string, any>[];
  language?: "ar" | "en";
  orientation?: "portrait" | "landscape";
  fontSize?: "compact" | "standard" | "large";
  showKpis?: boolean;
  showSignatures?: boolean;
  signatures?: {
    preparedByTitle?: string;
    preparedByName?: string;
    reviewedByTitle?: string;
    reviewedByName?: string;
    approvedByTitle?: string;
    approvedByName?: string;
  };
}

export const PrintableReportDocument = forwardRef<
  HTMLDivElement,
  PrintableReportDocumentProps
>(function PrintableReportDocument(props, ref) {
  const {
    title,
    titleAr,
    subtitle,
    subtitleAr,
    propertyName,
    propertyCode,
    systemLogoUrl,
    propertyLogoUrl,
    generatedBy,
    generatedAt = new Date(),
    filtersSummary,
    kpis = [],
    columns,
    rows,
    language = "ar",
    orientation = "landscape",
    fontSize = "standard",
    showKpis = true,
    showSignatures = true,
    signatures,
  } = props;

  const isAr = language === "ar";
  const displayTitle = isAr ? titleAr || title : title;
  const rawSubtitle = isAr ? subtitleAr || subtitle : subtitle;
  const isSubtitleSameAsProperty =
    Boolean(rawSubtitle) &&
    Boolean(propertyName) &&
    rawSubtitle?.trim().toLowerCase() === propertyName?.trim().toLowerCase();

  const displaySubtitle = isSubtitleSameAsProperty ? undefined : rawSubtitle;

  const formattedDate =
    typeof generatedAt === "string"
      ? generatedAt
      : `${formatDate(generatedAt)} ${new Date(generatedAt).toLocaleTimeString(
          isAr ? "ar-EG" : "en-US",
          { hour: "2-digit", minute: "2-digit" },
        )}`;

  // Typography scaling - portrait has narrower horizontal space so title is scaled down cleanly
  const fontSizes = {
    compact: {
      body: "7pt",
      header: "7.5pt",
      title: orientation === "portrait" ? "11pt" : "12pt",
      subtitle: "6.5pt",
      padding: "2.5px 4px",
      kpiVal: "10pt",
      kpiLabel: "6.5pt",
    },
    standard: {
      body: "8pt",
      header: "8.5pt",
      title: orientation === "portrait" ? "12pt" : "14pt",
      subtitle: "7pt",
      padding: "3.5px 5px",
      kpiVal: "11pt",
      kpiLabel: "7pt",
    },
    large: {
      body: "9pt",
      header: "9.5pt",
      title: orientation === "portrait" ? "13pt" : "15pt",
      subtitle: "7.5pt",
      padding: "4.5px 6px",
      kpiVal: "12pt",
      kpiLabel: "7.5pt",
    },
  }[fontSize];

  const textAlignFor = (col: ReportColumnConfig): "left" | "center" | "right" =>
    col.align ||
    (col.type === "index" ||
    col.type === "number" ||
    col.type === "date" ||
    col.type === "status"
      ? "center"
      : isAr
        ? "right"
        : "left");

  const logoSrc = systemLogoUrl || SR_LOGO_TEAL;
  // Brand rule: logo width 1/7–1/2 of layout, min 35 mm with destination line.
  const logoWidth = orientation === "landscape" ? "40mm" : "36mm";

  const signatureTiers = [
    {
      title:
        signatures?.preparedByTitle || (isAr ? "إعداد وتجهيز" : "Prepared By"),
      name: signatures?.preparedByName || generatedBy || "",
      line: isAr ? "التوقيع والتاريخ" : "Signature & Date",
    },
    {
      title:
        signatures?.reviewedByTitle || (isAr ? "مراجعة وتدقيق" : "Reviewed By"),
      name:
        signatures?.reviewedByName ||
        (isAr ? "مدير السكن / الإشراف" : "Housing Manager / Supervisor"),
      line: isAr ? "التوقيع والتاريخ" : "Signature & Date",
    },
    {
      title:
        signatures?.approvedByTitle ||
        (isAr ? "اعتماد الإدارة" : "Approved By"),
      name:
        signatures?.approvedByName ||
        (isAr
          ? "مدير الموارد البشرية / المدير العام"
          : "HR Director / General Manager"),
      line: isAr ? "التوقيع والخاتم" : "Signature & Stamp",
    },
  ];

  const metaLabel: React.CSSProperties = {
    color: SR.teal,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    fontSize: "6pt",
  };

  return (
    <div
      ref={ref}
      dir={isAr ? "rtl" : "ltr"}
      className="sunrise-printable-document"
      style={{
        background: SR.white,
        color: SR.ink,
        fontFamily: isAr ? SR_FONT_ARABIC : SR_FONT_PRINT,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        colorAdjust: "exact",
      }}
    >
      <style>{`
        @page {
          size: ${orientation === "landscape" ? "A4 landscape" : "A4 portrait"};
          margin: 8mm 10mm;
        }
        @media print {
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .sunrise-printable-document {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .sunrise-report-table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .sunrise-report-table thead { display: table-header-group !important; }
          .sunrise-report-table tfoot { display: table-footer-group !important; }
          .sunrise-report-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print { display: none !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ── First-page masthead: teal top bar → logo · title · meta ── */}
      <div
        className="sunrise-report-first-page-header"
        style={{
          marginBottom: "8px",
          pageBreakAfter: "avoid",
          breakAfter: "avoid",
        }}
      >
        <div
          style={{ height: "5px", background: SR.teal, marginBottom: "8px" }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            paddingBottom: "8px",
            borderBottom: `1px solid ${SR.rule}`,
            marginBottom: "8px",
            direction: "ltr", // logos never flip in RTL
          }}
        >
          {/* Brand logo (official file, untouched) */}
          <div
            style={{
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <img
              src={logoSrc}
              alt="SUNRISE Resorts & Cruises"
              style={{
                width: logoWidth,
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>

          {/* Title block */}
          <div
            dir={isAr ? "rtl" : "ltr"}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "center",
              padding: "0 6px",
            }}
          >
            {propertyName && (
              <div
                style={{
                  fontSize: "7pt",
                  color: SR.sand,
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                {propertyName}
                {propertyCode && (
                  <span style={{ color: SR.muted, fontWeight: 400 }}>
                    {" "}
                    · {propertyCode}
                  </span>
                )}
              </div>
            )}
            <div
              style={{
                fontSize: fontSizes.title,
                fontWeight: 700,
                color: SR.tealDark,
                lineHeight: 1.15,
              }}
            >
              {displayTitle}
            </div>
            {displaySubtitle && (
              <div
                style={{
                  fontSize: fontSizes.subtitle,
                  color: SR.muted,
                  marginTop: "2px",
                  lineHeight: 1.2,
                }}
              >
                {displaySubtitle}
              </div>
            )}
          </div>

          {/* Meta + property logo */}
          <div
            style={{
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              dir={isAr ? "rtl" : "ltr"}
              style={{
                display: "grid",
                gridTemplateColumns: "auto auto",
                columnGap: "8px",
                rowGap: "1px",
                fontSize: "7pt",
                color: SR.ink,
                alignItems: "baseline",
              }}
            >
              <span style={metaLabel}>{isAr ? "التاريخ" : "Date"}</span>
              <span>{formattedDate}</span>
              {generatedBy && (
                <>
                  <span style={metaLabel}>{isAr ? "المستخدم" : "User"}</span>
                  <span>{generatedBy}</span>
                </>
              )}
              <span style={metaLabel}>{isAr ? "السجلات" : "Records"}</span>
              <span style={{ fontWeight: 700 }}>{rows.length}</span>
            </div>
            {propertyLogoUrl && propertyLogoUrl !== logoSrc && (
              <img
                src={propertyLogoUrl}
                alt="Property Logo"
                style={{
                  maxHeight: "34px",
                  maxWidth: "90px",
                  objectFit: "contain",
                }}
              />
            )}
          </div>
        </div>

        {/* Active filters */}
        {filtersSummary && Object.keys(filtersSummary).length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "5px",
              marginBottom: "8px",
              fontSize: "7pt",
            }}
          >
            <span style={{ ...metaLabel, marginInlineEnd: "2px" }}>
              {isAr ? "المحددات" : "Filters"}
            </span>
            {Object.entries(filtersSummary).map(([key, val]) => (
              <span
                key={key}
                style={{
                  background: SR.sandTint,
                  border: `1px solid ${SR.sand}55`,
                  borderRadius: "999px",
                  padding: "1px 7px",
                  color: SR.ink,
                }}
              >
                <span style={{ color: SR.muted }}>{key}:</span>{" "}
                <strong style={{ fontWeight: 700 }}>{val}</strong>
              </span>
            ))}
          </div>
        )}

        {/* KPI strip */}
        {showKpis && kpis.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(kpis.length, 6)}, minmax(0, 1fr))`,
              gap: "6px",
              marginBottom: "8px",
            }}
          >
            {kpis.map((kpi, idx) => (
              <div
                key={idx}
                style={{
                  borderTop: `2px solid ${SR.teal}`,
                  background: SR.tealTint,
                  padding: "5px 8px 4px",
                  textAlign: "start",
                }}
              >
                <div
                  style={{
                    fontSize: fontSizes.kpiLabel,
                    color: SR.muted,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {isAr ? kpi.labelAr || kpi.label : kpi.label}
                </div>
                <div
                  style={{
                    fontSize: fontSizes.kpiVal,
                    fontWeight: 700,
                    color: SR.tealDark,
                    lineHeight: 1.15,
                    marginTop: "1px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {kpi.value}
                </div>
                {(kpi.sublabel || kpi.sublabelAr) && (
                  <div style={{ fontSize: "6pt", color: SR.muted }}>
                    {isAr ? kpi.sublabelAr || kpi.sublabel : kpi.sublabel}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Data table: thead repeats per page, tfoot = slim brand footer per page ── */}
      <table
        className="sunrise-report-table"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          fontSize: fontSizes.body,
        }}
      >
        <thead style={{ display: "table-header-group" }}>
          <tr style={{ background: SR.teal, color: SR.white }}>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  width: col.width || "auto",
                  padding: fontSizes.padding,
                  textAlign: textAlignFor(col),
                  fontSize: fontSizes.header,
                  fontWeight: 700,
                  letterSpacing: "0.2px",
                  borderInlineEnd:
                    idx < columns.length - 1
                      ? "1px solid rgba(255,255,255,0.25)"
                      : "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {isAr ? col.headerAr || col.header : col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  textAlign: "center",
                  padding: "24px",
                  color: SR.muted,
                }}
              >
                {isAr
                  ? "لا توجد سجلات مطابقة لمعايير البحث المحددة"
                  : "No matching records found"}
              </td>
            </tr>
          ) : (
            rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                style={{
                  background: rIdx % 2 === 1 ? SR.tealTint : SR.white,
                  borderBottom: `1px solid ${SR.rule}`,
                  pageBreakInside: "avoid",
                  breakInside: "avoid",
                }}
              >
                {columns.map((col, cIdx) => {
                  const val =
                    col.type === "index"
                      ? rIdx + 1
                      : (row[col.key] ?? row[col.header] ?? "—");
                  const cellBase: React.CSSProperties = {
                    padding: fontSizes.padding,
                    textAlign: textAlignFor(col),
                    fontSize: fontSizes.body,
                  };

                  if (col.type === "status" || col.type === "badge") {
                    const tone = srStatusTone(val);
                    return (
                      <td key={col.key || cIdx} style={cellBase}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0 6px",
                            borderRadius: "999px",
                            fontWeight: 700,
                            fontSize: "6.8pt",
                            lineHeight: 1.6,
                            background: tone.bg,
                            color: tone.fg,
                            border: `1px solid ${tone.border}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {String(val)}
                        </span>
                      </td>
                    );
                  }

                  let displayVal = "—";
                  if (val !== null && val !== undefined && val !== "") {
                    if (val instanceof Date) {
                      displayVal = formatDate(val);
                    } else if (
                      typeof val === "string" &&
                      /^\d{4}-\d{2}-\d{2}(T|\b)/.test(val.trim())
                    ) {
                      displayVal = formatDate(val.trim().slice(0, 10));
                    } else {
                      displayVal = String(val);
                    }
                  }

                  const numeric =
                    col.type === "number" ||
                    col.type === "date" ||
                    col.type === "index";
                  return (
                    <td
                      key={col.key || cIdx}
                      style={{
                        ...cellBase,
                        fontWeight: col.type === "index" ? 700 : 400,
                        color: col.type === "index" ? SR.tealDark : SR.ink,
                        fontVariantNumeric: numeric
                          ? "tabular-nums"
                          : undefined,
                        wordBreak: "break-word",
                      }}
                    >
                      {displayVal}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>

        <tfoot style={{ display: "table-footer-group" }}>
          <tr>
            <td
              colSpan={columns.length}
              style={{ padding: "8px 0 0", border: "none" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  background: SR.teal,
                  color: SR.white,
                  fontSize: "6.8pt",
                  padding: "3px 10px",
                }}
              >
                <span>
                  {isAr
                    ? "SUNRISE Resorts & Cruises · نظام إدارة سكن العاملين · وثيقة داخلية سرية"
                    : "SUNRISE Resorts & Cruises · Staff Housing Management · Internal & Confidential"}
                </span>
                <span
                  style={{
                    background: SR.white,
                    color: SR.tealDark,
                    fontWeight: 700,
                    padding: "0 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayTitle} ·{" "}
                  {isAr ? `${rows.length} سجل` : `${rows.length} records`}
                </span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Approvals: printed once, after the last row ── */}
      {showSignatures && (
        <div
          style={{
            marginTop: "14px",
            pageBreakInside: "avoid",
            breakInside: "avoid",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "24px",
          }}
        >
          {signatureTiers.map((tier, i) => (
            <div key={i} style={{ textAlign: "start" }}>
              <div style={{ ...metaLabel, fontSize: "6.5pt" }}>
                {tier.title}
              </div>
              <div
                style={{
                  fontSize: "7.5pt",
                  color: SR.ink,
                  minHeight: "12px",
                  marginTop: "1px",
                }}
              >
                {tier.name}
              </div>
              <div
                style={{
                  borderBottom: `1px solid ${SR.ink}`,
                  marginTop: "22px",
                }}
              />
              <div
                style={{ fontSize: "6.3pt", color: SR.muted, marginTop: "2px" }}
              >
                {tier.line}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
