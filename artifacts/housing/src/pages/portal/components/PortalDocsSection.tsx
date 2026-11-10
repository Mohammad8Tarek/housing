import { useLanguage } from "@/context/LanguageContext";
import PortalDocuments from "@/components/PortalDocuments";

import { MessageSquare } from "lucide-react";

export function PortalDocsSection() {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          {ar ? "مستندات البوابة" : "Portal Documents"}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {ar
            ? "إدارة المستندات التي تظهر للموظفين في البوابة"
            : "Manage documents visible to profiles in the portal"}
        </p>
      </div>
      <PortalDocuments />
    </div>
  );
}
