// Properties table: hotel, schema, contacts, actions.
import { FileSpreadsheet } from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Edit,
  Trash,
  Building2,
  Phone,
  Mail,
  MessageCircle,
  Info,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { statusColor } from "./index.constants";
import type { PropertiesState } from "./usePropertiesState";

export function renderPropertiesTable(s: PropertiesState) {
  const {
    ar,
    setImportWizardOpen,
    setSelectedPropForImport,
    setSelectedPropForDetails,
    deleteMutation,
    openEdit,
    propVisible,
    isPropVisible,
    selectedRows,
    propList,
    allPropSelected,
    toggleSelectAllProp,
    togglePropRow,
  } = s;
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-10 px-3">
              <Checkbox
                checked={allPropSelected}
                onCheckedChange={toggleSelectAllProp}
              />
            </TableHead>
            {isPropVisible("name") && (
              <TableHead className="font-semibold">
                {ar ? "الاسم" : "Name"}
              </TableHead>
            )}
            {isPropVisible("code") && (
              <TableHead className="font-semibold">
                {ar ? "الكود" : "Code"}
              </TableHead>
            )}
            {isPropVisible("displayname") && (
              <TableHead className="font-semibold">
                {ar ? "اسم العرض" : "Display Name"}
              </TableHead>
            )}
            {isPropVisible("hrContacts") && (
              <TableHead className="font-semibold">
                {ar ? "إدارة الموارد البشرية" : "HR Management"}
              </TableHead>
            )}
            {isPropVisible("housingManagers") && (
              <TableHead className="font-semibold">
                {ar ? "إدارة السكن" : "Housing Management"}
              </TableHead>
            )}
            {isPropVisible("language") && (
              <TableHead className="font-semibold">
                {ar ? "اللغة" : "Language"}
              </TableHead>
            )}
            {isPropVisible("color") && (
              <TableHead className="font-semibold">
                {ar ? "اللون" : "Color"}
              </TableHead>
            )}
            {isPropVisible("status") && (
              <TableHead className="font-semibold">
                {ar ? "الحالة" : "Status"}
              </TableHead>
            )}
            {isPropVisible("actions") && (
              <TableHead className="font-semibold">
                {ar ? "الإجراءات" : "Actions"}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {propList.map((prop) => {
            const isPropSelected = selectedRows.has(prop.id);
            return (
              <TableRow
                key={prop.id}
                className={
                  isPropSelected ? "bg-primary/5" : "hover:bg-muted/20"
                }
              >
                <TableCell className="px-3">
                  <Checkbox
                    checked={isPropSelected}
                    onCheckedChange={() => togglePropRow(prop.id)}
                  />
                </TableCell>
                {isPropVisible("name") && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
                        style={{
                          backgroundColor: (prop as any).logo
                            ? "transparent"
                            : ((prop as any).primaryColor ?? "#0F2A44"),
                        }}
                      >
                        {(prop as any).logo ? (
                          <img
                            src={(prop as any).logo}
                            alt={prop.name}
                            className="w-8 h-8 rounded-lg object-contain border"
                          />
                        ) : (
                          <Building2 className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className="font-medium">{prop.name}</span>
                    </div>
                  </TableCell>
                )}
                {isPropVisible("code") && (
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">
                      {prop.code}
                    </span>
                  </TableCell>
                )}
                {isPropVisible("displayname") && (
                  <TableCell className="text-muted-foreground">
                    {prop.displayName || "—"}
                  </TableCell>
                )}
                {isPropVisible("hrContacts") && (
                  <TableCell className="max-w-xs">
                    {(prop as any).hrContact1Name ||
                    (prop as any).hrContact1Phone ||
                    (prop as any).hrContact1Email ? (
                      <div className="flex items-center justify-between gap-1.5 p-1.5 px-2 rounded-md bg-primary/5 border border-primary/15 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate text-[11px] text-foreground">
                            {(prop as any).hrContact1Name ||
                              (ar ? "مدير الموارد البشرية" : "HR Manager")}
                          </div>
                          {(prop as any).hrContact1Title && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              {(prop as any).hrContact1Title}
                            </div>
                          )}
                          {(prop as any).hrContact1Phone && (
                            <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 dir-ltr">
                              <Phone className="w-2.5 h-2.5 opacity-60 shrink-0" />
                              <span>{(prop as any).hrContact1Phone}</span>
                            </div>
                          )}
                          {(prop as any).hrContact1Email && (
                            <div
                              className="text-[10px] text-muted-foreground flex items-center gap-1 truncate dir-ltr"
                              title={(prop as any).hrContact1Email}
                            >
                              <Mail className="w-2.5 h-2.5 opacity-60 shrink-0" />
                              <span className="truncate">
                                {(prop as any).hrContact1Email}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(prop as any).hrContact1Phone && (
                            <>
                              <a
                                href={`tel:${(prop as any).hrContact1Phone}`}
                                className="p-1 rounded hover:bg-primary/20 text-primary transition-colors"
                                title={ar ? "اتصال" : "Call"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${String((prop as any).hrContact1Phone).replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                          {(prop as any).hrContact1Email && (
                            <a
                              href={`mailto:${(prop as any).hrContact1Email}`}
                              className="p-1 rounded hover:bg-blue-500/20 text-blue-600 transition-colors"
                              title={(prop as any).hrContact1Email}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="italic text-gray-400 text-xs">—</span>
                    )}
                  </TableCell>
                )}
                {isPropVisible("housingManagers") && (
                  <TableCell className="max-w-xs">
                    {(prop as any).housingManager1Name ||
                    (prop as any).housingManager1Phone ||
                    (prop as any).housingManager1Email ? (
                      <div className="flex items-center justify-between gap-1.5 p-1.5 px-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate text-[11px] text-foreground">
                            {(prop as any).housingManager1Name ||
                              (ar ? "مدير السكن" : "Housing Manager")}
                          </div>
                          {(prop as any).housingManager1Title && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              {(prop as any).housingManager1Title}
                            </div>
                          )}
                          {(prop as any).housingManager1Phone && (
                            <div className="text-[10px] font-mono text-amber-700 dark:text-amber-300 flex items-center gap-1 dir-ltr">
                              <Phone className="w-2.5 h-2.5 opacity-60 shrink-0" />
                              <span>{(prop as any).housingManager1Phone}</span>
                            </div>
                          )}
                          {(prop as any).housingManager1Email && (
                            <div
                              className="text-[10px] text-muted-foreground flex items-center gap-1 truncate dir-ltr"
                              title={(prop as any).housingManager1Email}
                            >
                              <Mail className="w-2.5 h-2.5 opacity-60 shrink-0" />
                              <span className="truncate">
                                {(prop as any).housingManager1Email}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(prop as any).housingManager1Phone && (
                            <>
                              <a
                                href={`tel:${(prop as any).housingManager1Phone}`}
                                className="p-1 rounded hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors"
                                title={ar ? "اتصال" : "Call"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${String((prop as any).housingManager1Phone).replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                          {(prop as any).housingManager1Email && (
                            <a
                              href={`mailto:${(prop as any).housingManager1Email}`}
                              className="p-1 rounded hover:bg-blue-500/20 text-blue-600 transition-colors"
                              title={(prop as any).housingManager1Email}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="italic text-gray-400 text-xs">—</span>
                    )}
                  </TableCell>
                )}
                {isPropVisible("language") && (
                  <TableCell>
                    <span className="text-xs">
                      {(prop as any).defaultLanguage === "ar"
                        ? "🇸🇦 العربية"
                        : "🇺🇸 English"}
                    </span>
                  </TableCell>
                )}
                {isPropVisible("color") && (
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 rounded border"
                        style={{
                          backgroundColor:
                            (prop as any).primaryColor ?? "#0F2A44",
                        }}
                      />
                      <span className="text-xs font-mono text-muted-foreground">
                        {(prop as any).primaryColor ?? "#0F2A44"}
                      </span>
                    </div>
                  </TableCell>
                )}
                {isPropVisible("status") && (
                  <TableCell>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor(prop.status)}`}
                    >
                      {ar
                        ? prop.status === "active"
                          ? "نشط"
                          : "غير نشط"
                        : prop.status}
                    </span>
                  </TableCell>
                )}
                {isPropVisible("actions") && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={
                          ar
                            ? "معلومات وتفاصيل العقار"
                            : "Property Details & Contacts"
                        }
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                        onClick={() => setSelectedPropForDetails(prop)}
                      >
                        <Info className="w-4 h-4" />
                      </Button>
                      <PermissionGate module="properties" action="edit">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={
                            ar
                              ? "استيراد تكوين الغرف والمباني"
                              : "Import Housing Config"
                          }
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => {
                            setSelectedPropForImport(prop);
                            setImportWizardOpen(true);
                          }}
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(prop)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate module="properties" action="delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            if (confirm(ar ? "هل أنت متأكد؟" : "Are you sure?"))
                              deleteMutation.mutate({ id: prop.id });
                          }}
                        >
                          <Trash className="w-4 h-4 text-red-500" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {propList.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={propVisible.size + 1}
                className="py-12 text-center"
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Building2 className="w-8 h-8 opacity-30" />
                  <p className="font-medium">
                    {ar ? "لم يتم العثور على عقارات" : "No properties found"}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
