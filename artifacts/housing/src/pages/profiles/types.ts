export type ProfileForm = {
  profileId: string;
  firstName: string;
  lastName: string;
  thirdName: string;
  fourthName: string;
  firstNameAr?: string;
  lastNameAr?: string;
  thirdNameAr?: string;
  fourthNameAr?: string;
  phone: string;
  address: string;
  nationalId: string;
  nationality: string;
  hireDate: string;
  gender: string;
  department: string;
  departmentAr?: string;
  jobTitle: string;
  jobTitleAr?: string;
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
  firstNameAr: "",
  lastNameAr: "",
  thirdNameAr: "",
  fourthNameAr: "",
  phone: "",
  address: "",
  nationalId: "",
  nationality: "",
  hireDate: "",
  gender: "M",
  department: "",
  departmentAr: "",
  jobTitle: "",
  jobTitleAr: "",
  level: "",
  status: "UNASSIGNED",
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
  firstNameAr?: string;
  lastNameAr?: string;
  thirdNameAr?: string;
  fourthNameAr?: string;
  phone: string;
  address: string;
  nationalId: string;
  nationality: string;
  gender: string;
  department: string;
  departmentAr?: string;
  jobTitle: string;
  jobTitleAr?: string;
  level: string;
  status: string;
  dateOfBirth: string;
  employmentType: string;
  companyName: string;
  contractEndDate?: string;
  idDocuments?: { id?: number; fileName: string; fileType: string; fileData: string; uploadedAt?: string }[];
};
