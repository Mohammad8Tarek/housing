export const pdfTextSafe = (
  str: string | null | undefined,
  fallback?: string,
): string => {
  if (!str) return "—";
  if (!/[\u0600-\u06FF]/.test(str)) return str;
  const latin = str.replace(/[^\x20-\x7E]/g, "").trim();
  return latin.length >= 2 ? latin : (fallback ?? "[AR]");
};

export const getComps = (h: any) =>
  Array.isArray(h.companions) ? h.companions : [];

export const getGuestNames = (h: any) => {
  const names = getComps(h)
    .map((c: any) => c.name)
    .filter(Boolean);
  return names.length ? names.join(", ") : "—";
};

export const getGuestRelations = (h: any) => {
  const rels = getComps(h)
    .map((c: any) => c.relation)
    .filter(Boolean);
  return rels.length ? [...new Set(rels)].join(", ") : "—";
};

export const getGuestDocs = (h: any) => {
  const docs = getComps(h)
    .map((c: any) => c.idNumber)
    .filter(Boolean);
  return docs.length ? docs.join(", ") : "—";
};

export const getGuestProfiles = (h: any, ar: boolean) => {
  return getComps(h).map((c: any) => {
    const parts = [
      Number(c.isChild) === 1 ? (ar ? "طفل" : "Child") : ar ? "بالغ" : "Adult",
      c.relation,
      c.idNumber ? `${ar ? "وثيقة" : "Doc"} ${c.idNumber}` : "",
      Number(c.isChild) === 1 && c.age != null
        ? `${c.age}${ar ? " سنة" : "y"}`
        : "",
    ].filter(Boolean);
    return { name: c.name, meta: parts.join(" - ") };
  });
};
