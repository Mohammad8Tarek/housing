// Module-level constants/types of GuestHosting (moved verbatim).

export type ProfileResult = {
  id: number;
  propertyId: number;
  propertyName: string | null;
  profileId: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
};

export type Companion = {
  name: string;
  idNumber: string;
  documentType: string;
  documentImage: string;
  documentFileName: string;
  relation: string;
  isChild: number;
  age: string;
};

export const defaultCompanion = (): Companion => ({
  name: "",
  idNumber: "",
  documentType: "ID",
  documentImage: "",
  documentFileName: "",
  relation: "",
  isChild: 0,
  age: "",
});

export const MAX_DOCUMENT_IMAGE_SIZE = 5 * 1024 * 1024;

export const ALLOWED_DOCUMENT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const DOCUMENT_IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";

export const statusColor = (s: string) => {
  switch (s) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "APPROVED":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "ACTIVE":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "COMPLETED":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    case "CANCELLED":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-600";
  }
};
