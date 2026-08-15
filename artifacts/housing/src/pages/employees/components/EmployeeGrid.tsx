import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Eye, Key, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { StatusBadge } from "./StatusBadge";

interface EmployeeGridProps {
  employees: any[];
  ar: boolean;
  onEdit: (emp: any) => void;
  onResetPassword: (emp: any) => void;
  onDelete: (id: number) => void;
}

export function EmployeeGrid({
  employees,
  ar,
  onEdit,
  onResetPassword,
  onDelete,
}: EmployeeGridProps) {
  if (employees.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
      {employees.map((emp) => (
        <Card
          key={emp.id}
          className="group overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/20 flex flex-col h-full relative bg-card"
        >
          {/* Header Section */}
          <div className="p-4 border-b bg-muted/10 relative">
            <div className="absolute top-3 rtl:left-3 ltr:right-3">
              <StatusBadge status={emp.status} />
            </div>

            <div className="flex flex-col items-center mt-2">
              <EmployeeAvatar
                firstName={emp.firstName}
                lastName={emp.lastName}
                photoUrl={emp.photoUrl}
                className="w-20 h-20 shadow-sm border-2 border-background"
              />
              <h3 className="mt-3 text-base font-semibold text-center line-clamp-2" title={`${emp.firstName} ${emp.lastName || ""} ${emp.thirdName || ""} ${emp.fourthName || ""}`.replace(/\s+/g, " ").trim()}>
                {`${emp.firstName} ${emp.lastName || ""} ${emp.thirdName || ""} ${emp.fourthName || ""}`.replace(/\s+/g, " ").trim()}
              </h3>
              <div className="mt-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono font-medium">
                {emp.employeeId}
              </div>
            </div>
          </div>

          <CardContent className="p-0 flex-1 flex flex-col">
            {/* Personal Information */}
            <div className="px-4 py-3 border-b border-border/50">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {ar ? "معلومات شخصية" : "Personal Information"}
              </h4>
              <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "الاسم الأول" : "First Name"}
                  </span>
                  <span className="font-medium truncate block text-xs" title={emp.firstName}>{emp.firstName || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "الاسم الثاني" : "Second Name"}
                  </span>
                  <span className="font-medium truncate block text-xs" title={emp.lastName}>{emp.lastName || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "الاسم الثالث" : "Third Name"}
                  </span>
                  <span className="font-medium truncate block text-xs" title={emp.thirdName}>{emp.thirdName || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "الاسم الرابع" : "Fourth Name"}
                  </span>
                  <span className="font-medium truncate block text-xs" title={emp.fourthName}>{emp.fourthName || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "الهوية" : "National ID"}
                  </span>
                  <span className="font-medium truncate block text-xs" title={emp.nationalId}>{emp.nationalId || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "الهاتف" : "Phone"}
                  </span>
                  <span className="font-medium truncate block text-xs text-left" title={emp.phone} dir="ltr">{emp.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "الجنسية" : "Nationality"}
                  </span>
                  <span className="font-medium truncate block text-xs" title={emp.nationality}>{emp.nationality || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "الجنس" : "Gender"}
                  </span>
                  <span className="font-medium truncate block text-xs" title={emp.gender === "M" ? (ar ? "ذكر" : "Male") : emp.gender === "F" ? (ar ? "أنثى" : "Female") : ""}>
                    {emp.gender === "M"
                      ? ar
                        ? "ذكر"
                        : "Male"
                      : emp.gender === "F"
                        ? ar
                          ? "أنثى"
                          : "Female"
                        : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Job Information */}
            <div className="px-4 py-3 flex-1">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {ar ? "معلومات الوظيفة" : "Job Information"}
              </h4>
              <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                <div className="col-span-2">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "المسمى الوظيفي" : "Job Title"}
                  </span>
                  <span className="font-medium truncate block text-xs" title={emp.jobTitle}>{emp.jobTitle || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "القسم" : "Department"}
                  </span>
                  <span className="font-medium truncate block text-xs" title={emp.department}>{emp.department || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "الدرجة" : "Level"}
                  </span>
                  <span className="font-medium truncate block text-xs" title={emp.level}>{emp.level || "—"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "تاريخ التعيين" : "Hire Date"}
                  </span>
                  <span className="font-medium truncate block text-xs">
                    {emp.hireDate
                      ? new Date(emp.hireDate).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-3 bg-muted/5 border-t flex items-center justify-center gap-2 mt-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-2"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    {ar ? "إجراءات" : "Actions"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <PermissionGate module="employees" action="edit">
                    <DropdownMenuItem onClick={() => onEdit(emp)}>
                      <Pencil className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                      {ar ? "تعديل" : "Edit"}
                    </DropdownMenuItem>
                  </PermissionGate>
                  <DropdownMenuItem
                    onClick={() =>
                      (window.location.href = `/employees/${emp.id}`)
                    }
                  >
                    <Eye className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                    {ar ? "عرض التفاصيل" : "View Details"}
                  </DropdownMenuItem>
                  <PermissionGate module="employees" action="edit">
                    <DropdownMenuItem onClick={() => onResetPassword(emp)}>
                      <Key className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                      {ar ? "إعادة تعيين كلمة المرور" : "Reset Password"}
                    </DropdownMenuItem>
                  </PermissionGate>
                  <PermissionGate module="employees" action="delete">
                    <DropdownMenuItem
                      onClick={() => onDelete(emp.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                      {ar ? "حذف" : "Delete"}
                    </DropdownMenuItem>
                  </PermissionGate>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
