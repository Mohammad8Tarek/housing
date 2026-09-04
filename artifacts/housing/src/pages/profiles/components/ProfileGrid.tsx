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
import { Eye, Key, Pencil, Trash2, ArrowRightLeft, MoreVertical } from "lucide-react";
import { Link } from "wouter";
import { ProfileAvatar } from "./ProfileAvatar";
import { StatusBadge } from "./StatusBadge";

interface ProfileGridProps {
  profiles: any[];
  ar: boolean;
  onEdit: (emp: any) => void;
  onResetPassword: (emp: any) => void;
  onDelete: (id: number) => void;
}

export function ProfileGrid({
  profiles,
  ar,
  onEdit,
  onResetPassword,
  onDelete,
}: ProfileGridProps) {
  if (profiles.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
      {profiles.map((emp) => (
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
              <ProfileAvatar
                firstName={emp.firstName}
                lastName={emp.lastName}
                photoUrl={emp.photoUrl}
                size="md"
              />
              <h3 className="mt-3 text-base font-semibold text-center line-clamp-2" title={`${emp.firstName} ${emp.lastName || ""} ${emp.thirdName || ""} ${emp.fourthName || ""}`.replace(/\s+/g, " ").trim()}>
                {`${emp.firstName} ${emp.lastName || ""} ${emp.thirdName || ""} ${emp.fourthName || ""}`.replace(/\s+/g, " ").trim()}
              </h3>
              <div className="mt-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono font-medium">
                {emp.profileId}
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
                {ar ? "معلومات الوظيفة والجهة" : "Job Information"}
              </h4>
              {emp.employmentType === "THIRD_PARTY" ? (
                <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground block mb-0.5">
                      {ar ? "الوظيفة / المهنة" : "Job / Occupation"}
                    </span>
                    <span className="font-medium truncate block text-xs" title={emp.jobTitle}>
                      {emp.jobTitle || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">
                      {ar ? "اسم الشركة" : "Company"}
                    </span>
                    <span className="font-semibold truncate block text-xs text-purple-700 dark:text-purple-300" title={emp.companyName}>
                      {emp.companyName || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">
                      {ar ? "نوع التوظيف" : "Employment Type"}
                    </span>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] px-1.5 py-0 font-semibold">
                      {ar ? "طرف ثالث" : "Third Party"}
                    </Badge>
                  </div>
                </div>
              ) : (
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
                    <span className="font-medium truncate block text-xs" title={emp.level}>
                      {emp.level ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25 font-bold px-1.5 py-0 text-[11px]">
                          {emp.level}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">
                      {ar ? "نوع التوظيف" : "Employment Type"}
                    </span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 font-semibold">
                      {ar ? "داخلي" : "Internal"}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">
                      {ar ? "يعمل لدى" : "Works For"}
                    </span>
                    <span className="font-medium truncate block text-xs" title={emp.companyName}>
                      {emp.companyName || (emp.employmentType === "INTERNAL" ? (ar ? "الفندق" : "Hotel") : "—")}
                    </span>
                  </div>
                  <div>
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
              )}
            </div>

            {/* Actions Footer */}
            <div className="p-2.5 bg-muted/10 border-t flex items-center justify-between gap-1.5 mt-auto">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs gap-1.5 text-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                <Link href={`/profiles/${emp.id}`}>
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  {ar ? "عرض الملف" : "View"}
                </Link>
              </Button>

              <PermissionGate module="profiles" action="edit">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  onClick={() => onEdit(emp)}
                  title={ar ? "تعديل" : "Edit"}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </PermissionGate>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title={ar ? "خيارات إضافية" : "More options"}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 shadow-lg">
                  <DropdownMenuItem asChild>
                    <Link href={`/profiles/${emp.id}`} className="cursor-pointer">
                      <Eye className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-blue-500" />
                      {ar ? "عرض التفاصيل الكاملة" : "View Full Details"}
                    </Link>
                  </DropdownMenuItem>
                  <PermissionGate module="profiles" action="edit">
                    <DropdownMenuItem onClick={() => onEdit(emp)} className="cursor-pointer">
                      <Pencil className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-amber-500" />
                      {ar ? "تعديل الملف الشخصي" : "Edit Profile"}
                    </DropdownMenuItem>
                  </PermissionGate>
                  <PermissionGate module="profiles" action="edit">
                    <DropdownMenuItem onClick={() => onResetPassword(emp)} className="cursor-pointer">
                      <Key className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-indigo-500" />
                      {ar ? "إعادة تعيين كلمة المرور" : "Reset Password"}
                    </DropdownMenuItem>
                  </PermissionGate>
                  <PermissionGate module="profiles" action="delete">
                    <DropdownMenuItem
                      onClick={() => onDelete(emp.id)}
                      className="text-destructive font-medium cursor-pointer focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-destructive" />
                      {ar ? "حذف الملف الشخصي" : "Delete Profile"}
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
