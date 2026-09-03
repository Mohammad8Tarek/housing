export type ProfileForm = {
  profileId: string;
  firstName: string;
  lastName: string;
  thirdName: string;
  fourthName: string;
  phone: string;
  address: string;
  nationalId: string;
  nationality: string;
  hireDate: string;
  gender: string;
  department: string;
  jobTitle: string;
  level: string;
  status: string;
  dateOfBirth: string;
  employmentType: string;
  companyName: string;
  contractEndDate?: string;
  idDocuments?: { fileName: string; fileType: string; fileData: string }[];
};

export const EMPTY_FORM: ProfileForm = {
  profileId: "",
  firstName: "",
  lastName: "",
  thirdName: "",
  fourthName: "",
  phone: "",
  address: "",
  nationalId: "",
  nationality: "",
  hireDate: "",
  gender: "M",
  department: "",
  jobTitle: "",
  level: "",
  status: "ACTIVE",
  dateOfBirth: "",
  employmentType: "INTERNAL",
  companyName: "",
  contractEndDate: "",
  idDocuments: [],
};

export type EditEmpForm = {
  firstName: string;
  lastName: string;
  thirdName: string;
  fourthName: string;
  phone: string;
  address: string;
  nationalId: string;
  nationality: string;
  gender: string;
  department: string;
  jobTitle: string;
  level: string;
  status: string;
  dateOfBirth: string;
  employmentType: string;
  companyName: string;
  contractEndDate?: string;
  idDocuments?: { id?: number; fileName: string; fileType: string; fileData: string; uploadedAt?: string }[];
};
