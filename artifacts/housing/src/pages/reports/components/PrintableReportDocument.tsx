import React, { forwardRef } from "react";
import { formatDate } from "@/lib/date-utils";

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
  color?: "blue" | "emerald" | "amber" | "rose" | "slate";
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
  const displaySubtitle = isAr
    ? subtitleAr || subtitle || propertyName
    : subtitle || propertyName;

  const formattedDate =
    typeof generatedAt === "string"
      ? generatedAt
      : `${formatDate(generatedAt)} ${new Date(generatedAt).toLocaleTimeString(
          isAr ? "ar-EG" : "en-US",
          { hour: "2-digit", minute: "2-digit" },
        )}`;

  // Typography scaling
  const fontSizes = {
    compact: {
      body: "7pt",
      header: "7.5pt",
      title: "10pt",
      subtitle: "6.8pt",
      padding: "2.5px 4px",
      kpiVal: "10pt",
      kpiLabel: "6.5pt",
    },
    standard: {
      body: "8pt",
      header: "8.5pt",
      title: "11.5pt",
      subtitle: "7.2pt",
      padding: "3.5px 5px",
      kpiVal: "11pt",
      kpiLabel: "7pt",
    },
    large: {
      body: "9pt",
      header: "9.5pt",
      title: "12.5pt",
      subtitle: "7.8pt",
      padding: "4.5px 6px",
      kpiVal: "12pt",
      kpiLabel: "7.5pt",
    },
  }[fontSize];

  return (
    <div
      ref={ref}
      dir={isAr ? "rtl" : "ltr"}
      className="sunrise-printable-document bg-white text-slate-900"
      style={{
        fontFamily:
          isAr
            ? "'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
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
          .sunrise-report-table thead {
            display: table-header-group !important;
          }
          .sunrise-report-table tfoot {
            display: table-footer-group !important;
          }
          .sunrise-report-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Main Document Table layout for flawless multi-page repeat */}
      <table
        className="sunrise-report-table w-full border-collapse"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          fontSize: fontSizes.body,
        }}
      >
        {/* Table Header containing Branded Header & Column Names */}
        <thead style={{ display: "table-header-group" }}>
          <tr>
            <th
              colSpan={columns.length}
              style={{
                padding: 0,
                fontWeight: "normal",
                textAlign: isAr ? "right" : "left",
                border: "none",
                background: "transparent",
              }}
            >
              {/* Top Corporate Branding Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "2px solid #0f2a44",
                  paddingBottom: "6px",
                  marginBottom: "8px",
                }}
              >
                {/* Brand / Hotel Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {systemLogoUrl ? (
                    <img
                      src={systemLogoUrl}
                      alt="Logo"
                      style={{ maxHeight: "36px", objectFit: "contain" }}
                    />
                  ) : (
                    <div
                      style={{
                        background: "#0f2a44",
                        color: "#ffffff",
                        fontWeight: 900,
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "10pt",
                        letterSpacing: "0.5px",
                      }}
                    >
                      SUNRISE
                    </div>
                  )}
                  <div>
                    <div
                      style={{
                        fontSize: "9pt",
                        fontWeight: 800,
                        color: "#0f2a44",
                        lineHeight: 1.2,
                      }}
                    >
                      {isAr
                        ? "منتجعات وفنادق صن رايز — إدارة سكن العاملين"
                        : "Sunrise Resorts & Cruises — Staff Housing"}
                    </div>
                    {propertyName && (
                      <div
                        style={{
                          fontSize: "7.5pt",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        {propertyName}{" "}
                        {propertyCode && (
                          <span style={{ fontFamily: "monospace" }}>
                            [{propertyCode}]
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Report Title & Subtitle */}
                <div style={{ textAlign: "center", flex: 1, padding: "0 10px" }}>
                  <div
                    style={{
                      fontSize: fontSizes.title,
                      fontWeight: 800,
                      color: "#0f2a44",
                      lineHeight: 1.2,
                      letterSpacing: "0.2px",
                    }}
                  >
                    {displayTitle}
                  </div>
                  {displaySubtitle && (
                    <div
                      style={{
                        fontSize: fontSizes.subtitle,
                        color: "#475569",
                        fontWeight: 600,
                        marginTop: "1.5px",
                      }}
                    >
                      {displaySubtitle}
                    </div>
                  )}
                </div>

                {/* Property Logo & Metadata */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    textAlign: isAr ? "left" : "right",
                  }}
                >
                  <div style={{ fontSize: "7pt", color: "#64748b", lineHeight: 1.3 }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>
                        {isAr ? "التاريخ:" : "Date:"}
                      </span>{" "}
                      {formattedDate}
                    </div>
                    {generatedBy && (
                      <div>
                        <span style={{ fontWeight: 700 }}>
                          {isAr ? "المستخدم:" : "User:"}
                        </span>{" "}
                        {generatedBy}
                      </div>
                    )}
                    <div>
                      <span style={{ fontWeight: 700 }}>
                        {isAr ? "السجلات:" : "Records:"}
                      </span>{" "}
                      {rows.length}
                    </div>
                  </div>
                  {propertyLogoUrl && propertyLogoUrl !== systemLogoUrl && (
                    <img
                      src={propertyLogoUrl}
                      alt="Property Logo"
                      style={{ maxHeight: "34px", objectFit: "contain" }}
                    />
                  )}
                </div>
              </div>

              {/* Active Filter Indicators Bar */}
              {filtersSummary && Object.keys(filtersSummary).length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "6px",
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    marginBottom: "8px",
                    fontSize: "7pt",
                  }}
                >
                  <span style={{ fontWeight: 800, color: "#0f2a44" }}>
                    🔍 {isAr ? "المحددات النشطة:" : "Active Filters:"}
                  </span>
                  {Object.entries(filtersSummary).map(([key, val]) => (
                    <span
                      key={key}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "3px",
                        padding: "1px 5px",
                        color: "#334155",
                        fontWeight: 600,
                      }}
                    >
                      <strong style={{ color: "#0f2a44" }}>{key}:</strong> {val}
                    </span>
                  ))}
                </div>
              )}

              {/* Optional KPI Summary Strip */}
              {showKpis && kpis.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.min(
                      kpis.length,
                      6,
                    )}, minmax(0, 1fr))`,
                    gap: "6px",
                    marginBottom: "8px",
                  }}
                >
                  {kpis.map((kpi, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                        padding: "4px 6px",
                        background: "#f8fafc",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: fontSizes.kpiVal,
                          fontWeight: 900,
                          color: "#0f2a44",
                          lineHeight: 1.1,
                        }}
                      >
                        {kpi.value}
                      </div>
                      <div
                        style={{
                          fontSize: fontSizes.kpiLabel,
                          color: "#475569",
                          fontWeight: 700,
                          marginTop: "1px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {isAr ? kpi.labelAr || kpi.label : kpi.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </th>
          </tr>

          {/* Actual Column Headers Row */}
          <tr
            style={{
              background: "#0f2a44",
              color: "#ffffff",
              borderBottom: "1.5px solid #091a2b",
            }}
          >
            {columns.map((col, idx) => {
              const headerText = isAr
                ? col.headerAr || col.header
                : col.header;
              const textAlign =
                col.align ||
                (col.type === "index" ||
                col.type === "number" ||
                col.type === "date" ||
                col.type === "status"
                  ? "center"
                  : isAr
                  ? "right"
                  : "left");

              return (
                <th
                  key={col.key || idx}
                  style={{
                    width: col.width || "auto",
                    padding: fontSizes.padding,
                    textAlign,
                    fontSize: fontSizes.header,
                    fontWeight: 800,
                    letterSpacing: "0.2px",
                    borderRight:
                      idx < columns.length - 1
                        ? "1px solid rgba(255,255,255,0.15)"
                        : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {headerText}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Data Rows */}
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  textAlign: "center",
                  padding: "24px",
                  color: "#64748b",
                  fontStyle: "italic",
                }}
              >
                {isAr
                  ? "لا توجد سجلات مطابقة لمعايير البحث المحددة"
                  : "No matching records found"}
              </td>
            </tr>
          ) : (
            rows.map((row, rIdx) => {
              const isEven = rIdx % 2 === 0;
              return (
                <tr
                  key={rIdx}
                  style={{
                    background: isEven ? "#ffffff" : "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    pageBreakInside: "avoid",
                    breakInside: "avoid",
                  }}
                >
                  {columns.map((col, cIdx) => {
                    const val =
                      col.type === "index" ? rIdx + 1 : row[col.key] ?? row[col.header] ?? "—";
                    const textAlign =
                      col.align ||
                      (col.type === "index" ||
                      col.type === "number" ||
                      col.type === "date" ||
                      col.type === "status"
                        ? "center"
                        : isAr
                        ? "right"
                        : "left");

                    // Render status badges with print-safe styles
                    if (col.type === "status" || col.type === "badge") {
                      const str = String(val).toLowerCase();
                      let badgeBg = "#f1f5f9";
                      let badgeColor = "#475569";
                      let badgeBorder = "#cbd5e1";

                      if (
                        str.includes("active") ||
                        str.includes("نشط") ||
                        str.includes("available") ||
                        str.includes("شاغر") ||
                        str.includes("clean") ||
                        str.includes("جاهز") ||
                        str.includes("confirmed") ||
                        str.includes("مؤكد")
                      ) {
                        badgeBg = "#dcfce7";
                        badgeColor = "#15803d";
                        badgeBorder = "#86efac";
                      } else if (
                        str.includes("occupied") ||
                        str.includes("مشغول") ||
                        str.includes("dirty") ||
                        str.includes("متسخ") ||
                        str.includes("pending") ||
                        str.includes("معلق") ||
                        str.includes("vacation") ||
                        str.includes("إجازة")
                      ) {
                        badgeBg = "#fef3c7";
                        badgeColor = "#b45309";
                        badgeBorder = "#fde68a";
                      } else if (
                        str.includes("out_of_service") ||
                        str.includes("out_of_order") ||
                        str.includes("صيانة") ||
                        str.includes("rejected") ||
                        str.includes("مرفوض") ||
                        str.includes("cancelled") ||
                        str.includes("ملغي")
                      ) {
                        badgeBg = "#fee2e2";
                        badgeColor = "#b91c1c";
                        badgeBorder = "#fca5a5";
                      }

                      return (
                        <td
                          key={col.key || cIdx}
                          style={{
                            padding: fontSizes.padding,
                            textAlign,
                            borderRight: "1px solid #f1f5f9",
                            fontSize: fontSizes.body,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "1px 6px",
                              borderRadius: "3px",
                              fontWeight: 700,
                              fontSize: "6.8pt",
                              background: badgeBg,
                              color: badgeColor,
                              border: `1px solid ${badgeBorder}`,
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

                    return (
                      <td
                        key={col.key || cIdx}
                        style={{
                          padding: fontSizes.padding,
                          textAlign,
                          borderRight: "1px solid #f1f5f9",
                          fontSize: fontSizes.body,
                          fontWeight: col.type === "index" ? 700 : 500,
                          color: col.type === "index" ? "#0f2a44" : "#1e293b",
                          fontFamily:
                            col.type === "number" || col.type === "date"
                              ? "monospace"
                              : "inherit",
                          wordBreak: "break-word",
                        }}
                      >
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>

        {/* Footer containing Summary & Approvals */}
        <tfoot style={{ display: "table-footer-group" }}>
          <tr>
            <td
              colSpan={columns.length}
              style={{
                paddingTop: "10px",
                border: "none",
                background: "transparent",
              }}
            >
              {/* Official 3-Tier Approval Signatures Box */}
              {showSignatures && (
                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    background: "#ffffff",
                    padding: "8px 14px",
                    marginTop: "8px",
                    marginBottom: "6px",
                    pageBreakInside: "avoid",
                    breakInside: "avoid",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "20px",
                      textAlign: "center",
                    }}
                  >
                    {/* Tier 1: Prepared By */}
                    <div>
                      <div
                        style={{
                          fontSize: "7.5pt",
                          fontWeight: 800,
                          color: "#0f2a44",
                          marginBottom: "2px",
                        }}
                      >
                        {signatures?.preparedByTitle ||
                          (isAr
                            ? "إعداد وتجهيز (Prepared By)"
                            : "Prepared By")}
                      </div>
                      <div
                        style={{
                          fontSize: "7pt",
                          color: "#64748b",
                          minHeight: "14px",
                        }}
                      >
                        {signatures?.preparedByName || generatedBy || "—"}
                      </div>
                      <div
                        style={{
                          borderBottom: "1px dashed #94a3b8",
                          marginTop: "20px",
                          width: "80%",
                          marginInline: "auto",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "6.5pt",
                          color: "#94a3b8",
                          marginTop: "2px",
                        }}
                      >
                        {isAr ? "التوقيع والتاريخ" : "Signature & Date"}
                      </div>
                    </div>

                    {/* Tier 2: Reviewed By */}
                    <div>
                      <div
                        style={{
                          fontSize: "7.5pt",
                          fontWeight: 800,
                          color: "#0f2a44",
                          marginBottom: "2px",
                        }}
                      >
                        {signatures?.reviewedByTitle ||
                          (isAr
                            ? "مراجعة وتدقيق (Reviewed By)"
                            : "Reviewed By (Housing Mgr)")}
                      </div>
                      <div
                        style={{
                          fontSize: "7pt",
                          color: "#64748b",
                          minHeight: "14px",
                        }}
                      >
                        {signatures?.reviewedByName || "مدير السكن / الإشراف"}
                      </div>
                      <div
                        style={{
                          borderBottom: "1px dashed #94a3b8",
                          marginTop: "20px",
                          width: "80%",
                          marginInline: "auto",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "6.5pt",
                          color: "#94a3b8",
                          marginTop: "2px",
                        }}
                      >
                        {isAr ? "التوقيع والتاريخ" : "Signature & Date"}
                      </div>
                    </div>

                    {/* Tier 3: Approved By GM / HR */}
                    <div>
                      <div
                        style={{
                          fontSize: "7.5pt",
                          fontWeight: 800,
                          color: "#0f2a44",
                          marginBottom: "2px",
                        }}
                      >
                        {signatures?.approvedByTitle ||
                          (isAr
                            ? "اعتماد الإدارة (Approved By)"
                            : "Approved By (HR / GM)")}
                      </div>
                      <div
                        style={{
                          fontSize: "7pt",
                          color: "#64748b",
                          minHeight: "14px",
                        }}
                      >
                        {signatures?.approvedByName || "مدير الموارد البشرية / المدير العام"}
                      </div>
                      <div
                        style={{
                          borderBottom: "1px dashed #94a3b8",
                          marginTop: "20px",
                          width: "80%",
                          marginInline: "auto",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "6.5pt",
                          color: "#94a3b8",
                          marginTop: "2px",
                        }}
                      >
                        {isAr ? "التوقيع والخاتم" : "Signature & Stamp"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Copyright & Confidentiality Strip */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "6.8pt",
                  color: "#94a3b8",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "4px",
                }}
              >
                <span>
                  {isAr
                    ? "نظام إدارة سكن العاملين — منتجعات وفنادق صن رايز • وثيقة إدارية رسمية معتمدة"
                    : "Sunrise Staff Housing Management System • Official Confidential Document"}
                </span>
                <span>
                  {isAr
                    ? `إجمالي السجلات: ${rows.length}`
                    : `Total Records: ${rows.length}`}
                </span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
});
