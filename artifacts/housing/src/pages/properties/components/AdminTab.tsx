// Property dialog > Admin user tab: assign existing or create new.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Shield, Eye, EyeOff, UserPlus, UserCheck, Search, X, Users, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { PropertiesState } from "./usePropertiesState";

export function renderAdminTab(s: PropertiesState) {
  const { ar, editingId, form, setForm, showAdminPass, setShowAdminPass, userAssignMode, setUserAssignMode, selectedExistingUserIds, setSelectedExistingUserIds, userSearchQuery, setUserSearchQuery, allUsers } = s;
  return (
<TabsContent value="admin" className="space-y-4 mt-4">
              {/* Property code info */}
              <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20 flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                    {ar ? "كود العقار" : "Property Code"}
                  </p>
                  <p className="font-mono font-bold text-blue-700 dark:text-blue-400 mt-0.5">
                    {form.code ||
                      (ar
                        ? "— أدخل الكود �?ي تبويب عام —"
                        : "— enter code in General tab —")}
                  </p>
                </div>
              </div>

              {/* Mode Selection Cards */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ar ? "طريقة تعيين وإدارة المستخدمين للعقار" : "USER ASSIGNMENT METHOD"}
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Assign Existing Users */}
                  <div
                    onClick={() => setUserAssignMode("assign_existing")}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      userAssignMode === "assign_existing"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:border-primary/40 bg-card"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        userAssignMode === "assign_existing"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-foreground">
                          {ar ? "تعيين مستخدم حالي" : "Assign Existing User"}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {ar ? "مستحسن" : "Recommended"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {ar
                          ? "اختيار مسؤولين أو مشرفين مسجلين مسبقاً بالنظام ومنحهم حق الوصول لهذا العقار."
                          : "Select existing users and grant them access to this property with their current passwords."}
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Create New User */}
                  <div
                    onClick={() => setUserAssignMode("create_new")}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      userAssignMode === "create_new"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:border-primary/40 bg-card"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        userAssignMode === "create_new"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-sm text-foreground">
                        {ar ? "إنشاء مستخدم مسؤول جديد" : "Create New Admin User"}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {ar
                          ? "إنشاء حساب مستخدم وكلمة مرور جديدة مخصصة لإدارة هذا العقار تحديداً."
                          : "Create a brand new username and password dedicated for this property."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* View 1: Assign Existing Users */}
              {userAssignMode === "assign_existing" && (
                <div className="border rounded-xl overflow-hidden bg-card space-y-0">
                  <div className="p-3.5 bg-muted/40 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-bold text-xs uppercase tracking-wider">
                        {ar ? "قائمة المستخدمين المتاحين بالنظام" : "AVAILABLE SYSTEM USERS"}
                      </span>
                      <Badge variant="outline" className="text-[11px] font-mono">
                        {selectedExistingUserIds.length} {ar ? "محدد" : "selected"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedExistingUserIds.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setSelectedExistingUserIds([])}
                        >
                          {ar ? "إلغاء التحديد" : "Clear selection"}
                        </Button>
                      )}
                      <div className="relative w-full sm:w-48">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder={ar ? "بحث بالاسم أو الكود..." : "Search users..."}
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="h-8 text-xs pl-8 pr-3"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Selected Users Chips */}
                  {selectedExistingUserIds.length > 0 && (
                    <div className="p-3 bg-primary/5 border-b flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs font-semibold text-muted-foreground mr-1">
                        {ar ? "المستخدمون المعينون:" : "Assigned Users:"}
                      </span>
                      {selectedExistingUserIds.map((uid) => {
                        const u = allUsers.find((user: any) => user.id === uid);
                        if (!u) return null;
                        return (
                          <Badge
                            key={uid}
                            variant="secondary"
                            className="text-xs gap-1 py-1 px-2.5 bg-background border shadow-2xs"
                          >
                            <span className="font-semibold text-foreground">
                              {u.displayName || u.username}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              (@{u.username})
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedExistingUserIds((prev) => prev.filter((id) => id !== uid));
                              }}
                              className="ml-1 hover:text-rose-500 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Users Scrollable List */}
                  <div className="max-h-64 overflow-y-auto divide-y divide-border">
                    {(() => {
                      const filtered = (allUsers || []).filter((u: any) => {
                        if (!userSearchQuery.trim()) return true;
                        const q = userSearchQuery.toLowerCase().trim();
                        return (
                          (u.username || "").toLowerCase().includes(q) ||
                          (u.displayName || "").toLowerCase().includes(q) ||
                          (u.email || "").toLowerCase().includes(q) ||
                          (u.department || "").toLowerCase().includes(q) ||
                          (u.roles || []).some((r: string) => r.toLowerCase().includes(q))
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 text-center text-xs text-muted-foreground">
                            {userSearchQuery.trim()
                              ? (ar ? "لا يوجد مستخدم يطابق البحث" : "No users match search query")
                              : (ar ? "لا يوجد مستخدمون مسجلون بعد" : "No users registered yet")}
                          </div>
                        );
                      }

                      return filtered.map((u: any) => {
                        const isChecked = selectedExistingUserIds.includes(u.id);
                        const isAlreadyInProp = editingId
                          ? (u.propertyIds || []).includes(editingId) || u.propertyId === editingId
                          : false;

                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setSelectedExistingUserIds((prev) =>
                                prev.includes(u.id)
                                  ? prev.filter((id) => id !== u.id)
                                  : [...prev, u.id]
                              );
                            }}
                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                              isChecked ? "bg-primary/5" : "hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  setSelectedExistingUserIds((prev) =>
                                    checked
                                      ? [...new Set([...prev, u.id])]
                                      : prev.filter((id) => id !== u.id)
                                  );
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-foreground truncate">
                                    {u.displayName || u.username}
                                  </span>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    @{u.username}
                                  </span>
                                  {isAlreadyInProp && (
                                    <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
                                      {ar ? "معين حالياً" : "Currently Assigned"}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                  {u.department && <span>{u.department}</span>}
                                  {u.department && <span>•</span>}
                                  <span>
                                    {ar
                                      ? `لديه وصول لـ ${(u.propertyIds || []).length || 1} فرع/عقار`
                                      : `Access to ${(u.propertyIds || []).length || 1} properties`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {(u.roles || []).map((r: string) => (
                                <Badge
                                  key={r}
                                  variant="secondary"
                                  className="text-[10px] capitalize font-medium"
                                >
                                  {r.replace("_", " ")}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="p-3 bg-muted/20 border-t text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      {ar
                        ? "المستخدمون المحددون سيتم منحهم صلاحية الوصول لهذا العقار فور الحفظ دون الحاجة لتغيير كلمات المرور."
                        : "Selected users will be granted access to this property immediately without requiring password changes."}
                    </span>
                  </div>
                </div>
              )}

              {/* View 2: Create New Admin User */}
              {userAssignMode === "create_new" && (
                <div className="border rounded-xl overflow-hidden bg-card">
                  <div className="px-4 py-3 bg-muted/40 border-b flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">
                      {editingId
                        ? ar
                          ? "إضافة مستخدم جديد للعقار"
                          : "Add New User to Property"
                        : ar
                          ? "إنشاء مستخدم مسؤول جديد"
                          : "Create New Admin User"}
                    </p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {ar ? "اسم المستخدم" : "USERNAME"}
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        placeholder={
                          ar ? "مثال: manager.sunrise" : "e.g. manager.sunrise"
                        }
                        value={form.adminUsername}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            adminUsername: e.target.value,
                          }))
                        }
                        autoComplete="off"
                      />
                      {form.adminUsername.trim().toLowerCase() === "admin" && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          {ar
                            ? "ملاحظة: حساب 'admin' موجود مسبقاً، وسيتم منحه صلاحية إدارة هذا الفرع الجديد تلقائياً."
                            : "Note: 'admin' account already exists and will be granted access to this new property."}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {ar ? "كلمة المرور" : "PASSWORD"}
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type={showAdminPass ? "text" : "password"}
                          placeholder={
                            ar ? "الحد الأدنى 6 أحرف" : "Minimum 6 characters"
                          }
                          value={form.adminPassword}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              adminPassword: e.target.value,
                            }))
                          }
                          autoComplete="off"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPass((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showAdminPass ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      {ar
                        ? "سيتم إنشاء هذا الحساب ومنحه دور المسؤول (Admin) مع صلاحيات إدارة هذا العقار."
                        : "This account will be created with Admin role and granted full access to this property."}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
  );
}
