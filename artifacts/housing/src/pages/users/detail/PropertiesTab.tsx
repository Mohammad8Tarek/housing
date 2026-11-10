// User detail > Assigned properties tab.
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserDetailPageState } from "./useUserDetailPageState";

export function renderPropertiesTab(s: UserDetailPageState) {
  const { ar, currentUser, canGrantAnything, properties, selectedPropertyIds, setSelectedPropertyIds, primaryPropertyId, setPrimaryPropertyId } = s;
  return (
<div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    {ar ? "صلاحيات الوصول للفنادق والفروع (Multi-Tenant Scope)" : "Authorized Hotel Properties"}
                  </CardTitle>
                  <CardDescription>
                    {ar
                      ? "حدد الفنادق التي يُسمح لهذا المستخدم بالوصول إلى غرفها، نزلائها، وطلباتها."
                      : "Define which hotel schemas and branches this user is authorized to manage."}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allowedProps = canGrantAnything ? properties : properties.filter((p: any) => {
                        const actorPropIds = new Set<number>();
                        if (currentUser?.propertyId) actorPropIds.add(Number(currentUser.propertyId));
                        if (Array.isArray((currentUser as any)?.propertyIds)) {
                          (currentUser as any).propertyIds.forEach((id: any) => actorPropIds.add(Number(id)));
                        }
                        return actorPropIds.has(Number(p.id));
                      });
                      const allIds = allowedProps.map((p: any) => p.id);
                      setSelectedPropertyIds(allIds);
                      if (!primaryPropertyId && allIds.length > 0) setPrimaryPropertyId(allIds[0]);
                    }}
                    className="text-xs"
                  >
                    {ar ? "تحديد كافة الفنادق" : "Select All Hotels"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPropertyIds([]);
                      setPrimaryPropertyId(null);
                    }}
                    className="text-xs"
                  >
                    {ar ? "إلغاء التحديد" : "Deselect All"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map((property: any) => {
                  const isChecked = selectedPropertyIds.includes(property.id);
                  const isPrimary = primaryPropertyId === property.id;

                  return (
                    <div
                      key={property.id}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all flex flex-col justify-between gap-3",
                        isChecked
                          ? "border-[#0F2A44] bg-[#0F2A44]/5 shadow-sm"
                          : "border-border hover:border-border/80 bg-card"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(val) => {
                              if (val) {
                                setSelectedPropertyIds((prev) => [...prev, property.id]);
                                if (!primaryPropertyId) setPrimaryPropertyId(property.id);
                              } else {
                                setSelectedPropertyIds((prev) => prev.filter((id) => id !== property.id));
                                if (primaryPropertyId === property.id) {
                                  const remaining = selectedPropertyIds.filter((id) => id !== property.id);
                                  setPrimaryPropertyId(remaining[0] ?? null);
                                }
                              }
                            }}
                          />
                          <div>
                            <span className="font-bold text-sm block text-foreground">
                              {property.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ({property.code})
                            </span>
                          </div>
                        </label>

                        {isChecked && (
                          <button
                            type="button"
                            onClick={() => setPrimaryPropertyId(property.id)}
                            title={isPrimary ? (ar ? "الفندق الأساسي الحالي" : "Current Primary Hotel") : (ar ? "تعيين كفندق أساسي" : "Set as Primary Hotel")}
                            className={cn("p-1.5 rounded-lg border transition-colors", isPrimary ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground hover:bg-muted")}
                          >
                            <Star className={cn("w-4 h-4", isPrimary && "fill-amber-500")} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>{property.city || (ar ? "مصر" : "Egypt")}</span>
                        {isPrimary && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold">
                            ★ {ar ? "الفرع الأساسي" : "Primary"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
  );
}
