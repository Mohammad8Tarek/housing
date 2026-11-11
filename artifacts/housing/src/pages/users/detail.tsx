import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Building2,
  Pen,
  Trash2,
  RefreshCw,
  AlertTriangle,
  UserX,
  History,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserDetailPageState } from "./detail/useUserDetailPageState";
import { renderDetailHeader } from "./detail/DetailHeader";
import { renderSummaryCard } from "./detail/SummaryCard";
import { renderProfileTab } from "./detail/ProfileTab";
import { renderPermissionsTab } from "./detail/PermissionsTab";
import { renderPropertiesTab } from "./detail/PropertiesTab";
import { renderSignatureTab } from "./detail/SignatureTab";
import { renderAuditTab } from "./detail/AuditTab";
import { ActiveTab } from "./detail/detail.constants";

export default function UserDetailPage() {
  const s = useUserDetailPageState();
  const {
    setLocation,
    ar,
    buildNavHref,
    activeTab,
    handleTabChange,
    user,
    isUserLoading,
    isUserError,
    selectedPropertyIds,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    signaturePreview,
    diffStats,
    deleteMutation,
    handleDeleteUser,
  } = s;

  if (isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-[#C9A24D]" />
        <p className="text-sm font-medium text-muted-foreground">
          {ar
            ? "جاري تحميل ملف وحوكمة المستخدم..."
            : "Loading user governance profile..."}
        </p>
      </div>
    );
  }

  if (isUserError || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <UserX className="w-8 h-8 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {ar ? "المستخدم غير موجود" : "User Not Found"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {ar
              ? "تعذر العثور على المستخدم المطلوب أو قد تم حذفه."
              : "The requested user could not be found or was deleted."}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setLocation(buildNavHref("/users"))}
          className="mt-2"
        >
          {ar ? (
            <ArrowRight className="w-4 h-4 me-2" />
          ) : (
            <ArrowLeft className="w-4 h-4 me-2" />
          )}
          {ar ? "العودة لقائمة المستخدمين" : "Back to Users"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-2 sm:px-4">
      {/* ── Breadcrumb & Top Bar ── */}
      {renderDetailHeader(s)}

      {/* ── Enterprise User Identity Banner ── */}
      {renderSummaryCard(s)}

      {/* ── Tabs Navigation Bar ── */}
      <div className="border-b border-border/70 flex gap-2 overflow-x-auto pb-px">
        {[
          {
            id: "profile",
            label: ar ? "البيانات الأساسية والحساب" : "General & Profile",
            icon: User,
          },
          {
            id: "permissions",
            label: ar ? "مصفوفة الصلاحيات والحوكمة" : "Access & Permissions",
            icon: ShieldCheck,
            badge: diffStats.isIdentical ? null : ar ? "مخصص" : "Custom",
          },
          {
            id: "properties",
            label: ar ? "الفنادق والفروع" : "Hotel Properties",
            icon: Building2,
            count: selectedPropertyIds.length,
          },
          {
            id: "signature",
            label: ar ? "التوقيع الرقمي" : "Digital Signature",
            icon: Pen,
            badge: signaturePreview ? "✓" : null,
          },
          {
            id: "audit",
            label: ar ? "سجل النشاط والأمان" : "Security & Audit",
            icon: History,
          },
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as ActiveTab)}
              className={cn(
                "flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer",
                isSelected
                  ? "border-[#C9A24D] text-[#C9A24D] bg-[#C9A24D]/5 rounded-t-lg"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              <tab.icon
                className={cn(
                  "w-4 h-4",
                  isSelected ? "text-[#C9A24D]" : "text-muted-foreground",
                )}
              />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#C9A24D] text-white">
                  {tab.badge}
                </span>
              )}
              {typeof tab.count === "number" && tab.count > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tab.count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: PROFILE & GENERAL ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "profile" && renderProfileTab(s)}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: ACCESS & PERMISSIONS MATRIX ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "permissions" && renderPermissionsTab(s)}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: HOTELS & PROPERTIES SCOPE ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "properties" && renderPropertiesTab(s)}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: DIGITAL SIGNATURE ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "signature" && renderSignatureTab(s)}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 5: SECURITY & AUDIT TRAIL ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "audit" && renderAuditTab(s)}

      {/* ── Delete User Confirmation Alert Dialog ── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir={ar ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {ar ? "تأكيد حذف حساب المستخدم" : "Confirm User Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? `هل أنت متأكد من رغبتك في حذف المستخدم (${user.username}) نهائياً من النظام؟ لا يمكن التراجع عن هذه العملية.`
                : `Are you sure you want to permanently delete user (${user.username})? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {ar ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin me-1.5" />
              ) : (
                <Trash2 className="w-4 h-4 me-1.5" />
              )}
              {ar ? "تأكيد الحذف نهائياً" : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
