export function normalizeDates(obj: any) {
  if (!obj || typeof obj !== "object") return obj;

  for (const key in obj) {
    const value = obj[key];

    if (!value) continue;

    // لو string شكل ISO date
    if (typeof value === "string") {
      if (value.includes("T") && value.includes("Z")) {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          obj[key] = d;
        }
      }
    }

    // nested object
    if (typeof value === "object" && !Array.isArray(value)) {
      obj[key] = normalizeDates(value);
    }
  }

  return obj;
}
