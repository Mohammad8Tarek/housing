// Residents with no engagement.
import { Users } from "lucide-react";
import { CollapsibleSection } from "./PortalReports.constants";
import type {
  PortalReportsState,
  PortalReportsView,
} from "./usePortalReportsState";

export function renderNonEngagedProfiles(
  s: PortalReportsState,
  v: PortalReportsView,
  reportData: NonNullable<PortalReportsState["reportData"]>,
) {
  const { ar, expandedSections, toggleSection } = s;
  return (
    reportData.nonEngaged &&
    reportData.nonEngaged.length > 0 && (
      <CollapsibleSection
        title={
          ar
            ? `موظفون غير مشاركين (${reportData.nonEngaged.length})`
            : `Non-Engaged Profiles (${reportData.nonEngaged.length})`
        }
        icon={<Users className="w-4 h-4 text-red-500" />}
        expanded={expandedSections.nonEngaged !== false}
        onToggle={() => toggleSection("nonEngaged")}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                  {ar ? "الرقم الوظيفي" : "Profile ID"}
                </th>
                <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                  {ar ? "الاسم" : "Name"}
                </th>
                <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                  {ar ? "القسم" : "Department"}
                </th>
              </tr>
            </thead>
            <tbody>
              {reportData.nonEngaged.map((e: any, i: number) => (
                <tr key={i} className="border-b hover:bg-muted/20">
                  <td className="py-2 px-3 font-mono text-muted-foreground">
                    {e.profileId}
                  </td>
                  <td className="py-2 px-3 font-medium">{e.name}</td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {e.department}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    )
  );
}
