import type { Dispatch, SetStateAction } from "react";

export type Setter<T> = Dispatch<SetStateAction<T>>;

export type NewFormState = {
  profileId: string;
  firstName: string;
  lastName: string;
  thirdName: string;
  fourthName: string;
  nationalId: string;
  nationality: string;
  gender: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  hireDate: string;
  contractEndDate: string;
  department: string;
  jobTitle: string;
  level: string;
  employmentType: "INTERNAL" | "THIRD_PARTY";
  companyName: string;
  idDocuments: { fileName: string; fileType: string; fileData: string }[];
};

export type EditFormState = {
  checkInDate: string;
  checkOutDate: string;
  notes: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
  nationality: string;
  gender: string;
  profileCode: string;
  level: string;
  guestIdCardNumber: string;
  guestPhone: string;
  roomType: string;
  employmentType: string;
  companyName: string;
  roomId: string;
  bedNumber: string;
};

export type EditDialogState = { open: boolean; reservation: any | null };
export type CancelDialogState = {
  open: boolean;
  reservation: any | null;
  reason: string;
};
export type CheckinDialogState = {
  open: boolean;
  id: number | null;
  guestName?: string;
  reservation?: any;
};
export type WhatsAppDialogState = { open: boolean; reservation: any | null };
