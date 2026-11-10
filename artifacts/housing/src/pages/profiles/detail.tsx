import { Link } from "wouter";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft } from "lucide-react";
import { EditProfileDialog } from "./components/EditProfileDialog";
import { PrintLanguageDialog } from "@/lib/PrintLanguageDialog";
import { useProfileDetailState, buildProfileDetailView } from "./detail-parts/useProfileDetailState";
import { renderIdentityCard } from "./detail-parts/IdentityCard";
import { renderDocumentsCard } from "./detail-parts/DocumentsCard";
import { renderCurrentHousingCard } from "./detail-parts/CurrentHousingCard";
import { renderPortalAccessCard } from "./detail-parts/PortalAccessCard";
import { renderHousingHistoryCard } from "./detail-parts/HousingHistoryCard";
import { renderSetPasswordDialog } from "./detail-parts/SetPasswordDialog";
import { renderExtendStayDialog } from "./detail-parts/ExtendStayDialog";

export default function ProfileDetail() {
  const s = useProfileDetailState();
  const { profileId, ar, langDialogOpen, handleSelect, handleCancel, profile, empLoading, refetch, effectivePropId, previewDoc, setPreviewDoc, editProfileOpen, setEditProfileOpen, resetOpen, setResetOpen, pwSaving } = s;


  if (empLoading || !profileId)
    return (
      <div className="p-8">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (!profile)
    return (
      <div className="p-8 text-muted-foreground">
        {ar ? "الموظف غير موجود" : "Profile not found"}
      </div>
    );
  const v = buildProfileDetailView(s, profileId, profile);
  const { emp, resetPortalPassword } = v;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/profiles">
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1 rtl:rotate-180" />
          {ar ? "العودة للموظفين" : "Back to Profiles"}
        </Button>
      </Link>

      {/* Profile card */}
      {renderIdentityCard(s, v)}

      
      {/* Passport / ID Documents */}
      {renderDocumentsCard(s, v)}

      {/* Current assignment */}

      {renderCurrentHousingCard(s, v)}

      {/* Profile Portal Access */}
      {renderPortalAccessCard(s, v)}

      {/* Assignment history */}
      {renderHousingHistoryCard(s, v)}

      {/* Reset confirm */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "إعادة تعيين كلمة المرور" : "Reset Password"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "سيؤدي هذا إلى إنشاء كلمة مرور مؤقتة جديدة وإجبار الموظف على تغييرها عند تسجيل الدخول التالي."
                : "This will generate a new temporary password and force the profile to change it on next login."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pwSaving}>
              {ar ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={resetPortalPassword}
              disabled={pwSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pwSaving
                ? ar
                  ? "جاري العمل..."
                  : "Working..."
                : ar
                  ? "تأكيد"
                  : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set password dialog */}
      {renderSetPasswordDialog(s, v)}

      {/* Document Preview Lightbox Modal */}
      <DocumentPreviewModal
        doc={previewDoc}
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Extend Stay Dialog */}
      {renderExtendStayDialog(s, v)}

      {editProfileOpen && emp && (
        <EditProfileDialog
          profile={emp}
          propertyId={effectivePropId}
          onClose={() => {
            setEditProfileOpen(false);
            refetch();
          }}
        />
      )}

      <PrintLanguageDialog
        open={langDialogOpen}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </div>
  );
}
