// Profile detail: photo, identity and employment summary.
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Pencil } from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import {
  getProfileDisplayName,
  getProfileDisplayJobTitle,
  getProfileDisplayDepartment,
} from "@/lib/profile-display-utils";
import { ProfileAvatar } from "./detail.constants";
import type { ProfileDetailState, ProfileDetailView } from "./useProfileDetailState";

export function renderIdentityCard(s: ProfileDetailState, v: ProfileDetailView) {
  const { ar, fileRef, setEditProfileOpen, uploading, handlePhotoUpload } = s;
  const { emp, infoItems } = v;
  return (
<Card className="border-0 shadow-md overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="pt-0 pb-6">
          <div className="flex flex-col sm:flex-row gap-4 -mt-12">
            <div className="relative flex-shrink-0">
              <ProfileAvatar
                firstName={emp.firstName}
                lastName={emp.lastName}
                photoUrl={emp.photoUrl}
                size="lg"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
                title={ar ? "تغيير الصورة" : "Change photo"}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="pt-12 sm:pt-14 flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-bold">
                    {getProfileDisplayName(emp, ar)}
                  </h1>
                  {/* Alternate language name if available */}
                  {ar && (emp.firstName || emp.lastName) && (emp.firstNameAr || emp.lastNameAr) && (
                    <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">
                      English: {[emp.firstName, emp.thirdName, emp.fourthName, emp.lastName].filter(Boolean).join(" ")}
                    </p>
                  )}
                  {!ar && (emp.firstNameAr || emp.lastNameAr) && (
                    <p className="text-xs text-muted-foreground mt-0.5" dir="rtl">
                      العربية: {[emp.firstNameAr, emp.thirdNameAr, emp.fourthNameAr, emp.lastNameAr].filter(Boolean).join(" ")}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-muted-foreground font-mono text-sm">
                      {emp.profileId || emp.profileCode}
                    </span>
                    {emp.employmentType === "THIRD_PARTY" ? (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 font-semibold text-xs">
                        {ar ? "طرف ثالث" : "Third Party"}{emp.companyName ? ` • ${emp.companyName}` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 font-semibold text-xs">
                        {ar ? "موظف داخلي" : "Internal Employee"}{emp.companyName ? ` • ${emp.companyName}` : ""}
                      </Badge>
                    )}
                  </div>
                  {(emp.jobTitle || emp.jobTitleAr) && (
                    <div className="flex items-center gap-2 text-sm text-primary font-medium mt-1.5">
                      <span>{getProfileDisplayJobTitle(emp, ar)}</span>
                      {emp.employmentType !== "THIRD_PARTY" && (emp.department || emp.departmentAr) && (
                        <span className="text-muted-foreground text-xs">• {getProfileDisplayDepartment(emp, ar)}</span>
                      )}
                      {emp.employmentType !== "THIRD_PARTY" && emp.level && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25 font-bold px-2 py-0.5 text-xs shadow-2xs">
                          {emp.level}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 self-start">
                  <PermissionGate module="profiles" action="edit">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditProfileOpen(true)}
                      className="gap-1.5 shadow-xs font-semibold h-8"
                    >
                      <Pencil className="w-3.5 h-3.5 text-amber-500" />
                      <span>{ar ? "تعديل الملف" : "Edit Profile"}</span>
                    </Button>
                  </PermissionGate>
                  <div
                    className={`h-8 font-semibold text-xs rounded-full px-3 flex items-center gap-2 border shadow-xs ${
                      emp.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                        : emp.status === "VACATION"
                        ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                        : emp.status === "LEFT"
                        ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        emp.status === "ACTIVE"
                          ? "bg-emerald-500 animate-pulse"
                          : emp.status === "VACATION"
                          ? "bg-amber-500"
                          : emp.status === "LEFT"
                          ? "bg-slate-400"
                          : "bg-blue-500"
                      }`}
                    />
                    <span>
                      {emp.status === "ACTIVE"
                        ? (ar ? "مقيم بالسكن" : "In-House")
                        : emp.status === "VACATION"
                        ? (ar ? "في إجازة" : "On Vacation")
                        : emp.status === "LEFT"
                        ? (ar ? "مغادر" : "Checked Out")
                        : (ar ? "غير مسكّن" : "Unassigned")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-6">
            {infoItems.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-3 rounded-lg bg-muted/30"
              >
                <span className="text-muted-foreground mt-0.5 flex-shrink-0">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    {item.label}
                  </p>
                  <p className="text-sm font-medium truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
  );
}
