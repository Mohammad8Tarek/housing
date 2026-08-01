export type EmployeeForm = {
  employeeId: string;
  firstName: string;
  lastName: string;
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
};

export const EMPTY_FORM: EmployeeForm = {
  employeeId: "",
  firstName: "",
  lastName: "",
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
};
