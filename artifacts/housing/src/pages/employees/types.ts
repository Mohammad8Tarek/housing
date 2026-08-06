export type EmployeeForm = {
  employeeId: string;
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
};

export const EMPTY_FORM: EmployeeForm = {
  employeeId: "",
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
};
