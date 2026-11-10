// Module-level constants/types of Properties (moved verbatim).

export type PropertyForm = {
  name: string;
  code: string;
  displayName: string;
  status: string;
  defaultLanguage: string;
  primaryColor: string;
  description: string;
  adminUsername: string;
  adminPassword: string;
  logo: string;
  hrContact1Name: string;
  hrContact1Title: string;
  hrContact1Phone: string;
  hrContact1Email: string;
  hrContact2Name: string;
  hrContact2Title: string;
  hrContact2Phone: string;
  hrContact2Email: string;
  housingManager1Name: string;
  housingManager1Title: string;
  housingManager1Phone: string;
  housingManager1Email: string;
  housingManager2Name: string;
  housingManager2Title: string;
  housingManager2Phone: string;
  housingManager2Email: string;
};

export const EMPTY_FORM: PropertyForm = {
  name: "",
  code: "",
  displayName: "",
  status: "active",
  defaultLanguage: "en",
  primaryColor: "#0F2A44",
  description: "",
  adminUsername: "",
  adminPassword: "",
  logo: "",
  hrContact1Name: "",
  hrContact1Title: "",
  hrContact1Phone: "",
  hrContact1Email: "",
  hrContact2Name: "",
  hrContact2Title: "",
  hrContact2Phone: "",
  hrContact2Email: "",
  housingManager1Name: "",
  housingManager1Title: "",
  housingManager1Phone: "",
  housingManager1Email: "",
  housingManager2Name: "",
  housingManager2Title: "",
  housingManager2Phone: "",
  housingManager2Email: "",
};

export const statusColor = (s: string) =>
  s === "active"
    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
