import { ProfileProfilePopup } from "@/components/ui/profile-profile-popup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Baby, Image as ImageIcon, FileText, FileDown } from "lucide-react";
import { ColumnChooser } from "@/components/ui/column-chooser";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  ErrorState,
  EmptyState,
  TableSkeleton,
} from "@/components/ui/page-states";
import { PermissionGate } from "@/components/ui/permission-gate";
import { useGuestHostingState } from "./parts/useGuestHostingState";
import { renderHostingBulkBar } from "./parts/HostingBulkBar";
import { renderHostingsTable } from "./parts/HostingsTable";
import { renderEditHostingDialog } from "./parts/EditHostingDialog";
import { renderIssueAccessCardsDialog } from "./parts/IssueAccessCardsDialog";
import { resolveApiUrl } from "@/lib/api-origin";

export default function GuestHosting() {
  const s = useGuestHostingState();
  const { ar, profileEmpId, setProfileEmpId, companionsDetailHostingId, setCompanionsDetailHostingId, lightboxSrc, setLightboxSrc, lightboxName, setLightboxName, isLoading, isError, refetch, numericPropertyId, hostings, pagedHostings, dateText, getHostProfile, getHostName, getHostCode, getCompanions, getRoom, getRoomNumber, exportHostExcel, HOSTING_COLS, hVisible, hToggle, hShowAll, hHideAll, exportGuestProfilePdf } = s;


  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "استضافة الضيوف" : "Guest Hosting"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate module="guest_hosting" action="export">
            <Button
              variant="outline"
              size="sm"
              onClick={exportHostExcel}
              className="gap-1.5 text-xs font-semibold h-9"
            >
              <FileDown className="w-4 h-4" />
              {ar ? "تصدير Excel" : "Export Excel"}
            </Button>
          </PermissionGate>
          <ColumnChooser
            cols={HOSTING_COLS}
            visible={hVisible}
            onToggle={hToggle}
            onShowAll={hShowAll}
            onHideAll={hHideAll}
            ar={ar}
          />
        </div>
      </div>

      {renderHostingBulkBar(s)}

      {/* Table */}
      {isError ? (
        <ErrorState
          onRetry={() => refetch()}
          className="border rounded-lg bg-card my-4"
        />
      ) : isLoading ? (
        <TableSkeleton rows={5} columns={8} className="my-4" />
      ) : pagedHostings.length === 0 ? (
        <EmptyState
          title={ar ? "لا توجد استضافات" : "No Hostings Found"}
          description={
            ar
              ? "لم يتم العثور على أي بيانات استضافة مطابقة للبحث."
              : "No hosting data matches the search criteria."
          }
          className="border rounded-lg bg-card my-4"
        />
      ) : (
        renderHostingsTable(s)
      )}

      {/* Profile Profile Popup */}
      <ProfileProfilePopup
        profileId={profileEmpId}
        propertyId={numericPropertyId}
        onClose={() => setProfileEmpId(null)}
      />

      {/* Edit Hosting Dialog */}
      {renderEditHostingDialog(s)}

      {/* Guest Companions Detail Modal */}
      {companionsDetailHostingId &&
        (() => {
          const hosting = hostings?.find(
            (h: any) => h.id === companionsDetailHostingId,
          );
          if (!hosting) return null;
          const companions = getCompanions(hosting);
          const hostProfile = getHostProfile(hosting);
          const room = getRoom(hosting);
          return (
            <Dialog
              open={!!companionsDetailHostingId}
              onOpenChange={(open) => {
                if (!open) setCompanionsDetailHostingId(null);
              }}
            >
              <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between pr-8">
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {ar ? "بيانات الضيوف الكاملة" : "Complete Guest Details"}
                  </DialogTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportGuestProfilePdf(
                        hosting,
                        hostProfile,
                        room,
                        companions,
                      )
                    }
                    className="gap-2 text-red-700 border-red-200 hover:bg-red-50"
                  >
                    <FileText className="w-4 h-4" />
                    {ar ? "تصدير PDF" : "Export PDF"}
                  </Button>
                </DialogHeader>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "الموظف المستضيف" : "Host Profile"}
                      </p>
                      <p className="text-sm font-bold">
                        {getHostName(hosting)}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {getHostCode(hosting)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "بروفايل التسكين" : "Hosting Profile"}
                      </p>
                      <p className="text-sm font-bold">
                        {hosting.hostingType?.replace("_", " ") ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {hosting.status} • {hosting.guestsCount}{" "}
                        {ar ? "ضيف" : "guest(s)"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "الغرفة" : "Room"}
                      </p>
                      <p className="text-sm font-bold">
                        {getRoomNumber(hosting)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          room?.buildingName,
                          room?.floorNumber != null
                            ? `${ar ? "الدور" : "Floor"} ${room.floorNumber}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "من" : "From"}
                      </p>
                      <p className="text-sm font-medium">
                        {dateText(hosting.expectedFrom)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "إلى" : "To"}
                      </p>
                      <p className="text-sm font-medium">
                        {dateText(hosting.expectedTo)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "القسم/الوظيفة" : "Department / Job"}
                      </p>
                      <p className="text-sm font-medium">
                        {[hostProfile?.department, hostProfile?.jobTitle]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </p>
                    </div>
                  </div>
                  {hosting.notes && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "ملاحظات" : "Notes"}
                      </p>
                      <p className="text-sm">{hosting.notes}</p>
                    </div>
                  )}
                </div>

                {companions.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-muted-foreground">
                      {ar
                        ? "السجل محفوظ بعدد ضيوف فقط، ولا توجد أسماء أو بيانات مرافقين مسجلة"
                        : "This record only has a guest count. No guest names or companion details are saved."}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ar
                        ? "أي حجز جديد يتم إضافة الضيوف فيه سيظهر هنا تلقائياً."
                        : "New requests with added companions will show their details here automatically."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {companions.map((companion: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-5 rounded-lg border-2 ${
                          companion.isChild === 1
                            ? "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-300 dark:border-blue-700"
                            : "bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/30 dark:to-orange-900/30 border-amber-300 dark:border-amber-700"
                        }`}
                      >
                        {/* Header with Name and Type */}
                        <div className="flex items-start justify-between mb-4 pb-4 border-b-2 border-current border-opacity-10">
                          <div>
                            <h3 className="text-xl font-bold">
                              {companion.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {companion.isChild === 1 ? (
                                <Badge className="bg-blue-500 text-white text-xs py-1 px-2.5">
                                  <Baby className="w-3 h-3 mr-1" />
                                  {ar ? "طفل" : "Child"}
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-600 text-white text-xs py-1 px-2.5">
                                  <Users className="w-3 h-3 mr-1" />
                                  {ar ? "بالغ" : "Adult"}
                                </Badge>
                              )}
                              {companion.relation && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs py-1 px-2.5"
                                >
                                  {companion.relation}
                                </Badge>
                              )}
                              {companion.isChild === 1 && companion.age && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs py-1 px-2.5"
                                >
                                  {companion.age} {ar ? "سنة" : "year old"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            {ar ? "الضيف #" : "Guest #"}
                            {idx + 1}
                          </div>
                        </div>

                        {/* Personal Information Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {companion.idNumber && (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-current border-opacity-20">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">
                                {ar ? "رقم الهوية" : "ID/Passport Number"}
                              </p>
                              <p className="font-mono text-sm font-bold text-foreground mt-1">
                                {companion.idNumber}
                              </p>
                            </div>
                          )}

                          {companion.documentType && (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-current border-opacity-20">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">
                                {ar ? "نوع المستند" : "Document Type"}
                              </p>
                              <p className="text-sm font-medium text-foreground mt-1">
                                {companion.documentType === "ID"
                                  ? ar
                                    ? "بطاقة هوية"
                                    : "ID Card"
                                  : companion.documentType === "PASSPORT"
                                    ? ar
                                      ? "جواز سفر"
                                      : "Passport"
                                    : companion.documentType}
                              </p>
                            </div>
                          )}

                          {companion.relation && (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-current border-opacity-20">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">
                                {ar ? "صلة القرابة" : "Relation"}
                              </p>
                              <p className="text-sm font-medium text-foreground mt-1">
                                {companion.relation}
                              </p>
                            </div>
                          )}

                          {companion.isChild === 1 && companion.age && (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-current border-opacity-20">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">
                                {ar ? "العمر" : "Age"}
                              </p>
                              <p className="text-sm font-medium text-foreground mt-1">
                                {companion.age} {ar ? "سنة" : "years"}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Documents Section */}
                        {companion.documentImage && (
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-green-300 dark:border-green-700">
                            <p className="text-sm font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                              <ImageIcon className="w-4 h-4" />
                              {ar ? "المستندات المرفوعة" : "Uploaded Documents"}
                            </p>

                            <div className="space-y-3">
                              {companion.documentImage &&
                                (companion.documentImage.startsWith(
                                  "data:image/",
                                ) ||
                                  companion.documentImage.startsWith("http") ||
                                  companion.documentImage.startsWith("/api/") ||
                                  /\.(png|jpg|jpeg|gif|webp)$/i.test(
                                    companion.documentImage,
                                  )) && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLightboxSrc(resolveApiUrl(companion.documentImage));
                                        setLightboxName(
                                          companion.documentFileName,
                                        );
                                      }}
                                      className="w-full block text-left"
                                    >
                                      <img
                                        src={resolveApiUrl(companion.documentImage)}
                                        alt={
                                          companion.documentFileName ||
                                          (ar
                                            ? "صورة المستند"
                                            : "Document Image")
                                        }
                                        className="w-full max-h-96 object-contain rounded-lg border-2 border-green-200 dark:border-green-800 p-2 bg-gray-50 dark:bg-gray-700 hover:brightness-95 transition-all"
                                      />
                                    </button>
                                  </div>
                                )}

                              {companion.documentFileName && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-semibold">
                                    {ar ? "اسم الملف:" : "File Name:"}
                                  </span>{" "}
                                  {companion.documentFileName}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {!companion.documentImage && (
                          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-center">
                            <ImageIcon className="w-8 h-8 mx-auto opacity-30 mb-2" />
                            <p className="text-sm text-muted-foreground italic">
                              {ar
                                ? "لا توجد مستندات مرفوعة"
                                : "No documents uploaded"}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Summary */}
                    <div className="bg-muted/50 p-4 rounded-lg border border-muted-foreground/20">
                      <p className="text-sm font-semibold text-muted-foreground">
                        {ar
                          ? `إجمالي الضيوف: ${companions.length}`
                          : `Total Guests: ${companions.length}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ar
                          ? `${companions.filter((c: any) => c.isChild !== 1).length} بالغ • ${companions.filter((c: any) => c.isChild === 1).length} طفل`
                          : `${companions.filter((c: any) => c.isChild !== 1).length} adult • ${companions.filter((c: any) => c.isChild === 1).length} child`}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t gap-2">
                  <Button
                    onClick={() => setCompanionsDetailHostingId(null)}
                    className="px-6"
                  >
                    {ar ? "إغلاق" : "Close"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
      <ImageLightbox
        src={lightboxSrc}
        alt={lightboxName}
        fileName={lightboxName}
        onClose={() => setLightboxSrc(null)}
      />

      {/* ── Key Issuance Popup ── */}
      {renderIssueAccessCardsDialog(s)}
    </div>
  );
}
