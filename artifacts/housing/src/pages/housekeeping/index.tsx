import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Brush } from "lucide-react";
import { PageLoader } from "@/components/ui/loader";
import {
  useListBuildings,
  useListFloors,
  useListRooms,
} from "@workspace/api-client-react";
import { HousekeepingTab } from "../housing/components/HousekeepingTab";

export default function HousekeepingPage() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";

  const { data: bData, isLoading: bLoading } = useListBuildings({
    propertyId: activePropertyId as number,
    limit: 1000,
  } as any, { query: { enabled: !!activePropertyId } });
  
  const { data: fData, isLoading: fLoading } = useListFloors({
    propertyId: activePropertyId as number,
    limit: 1000,
  } as any, { query: { enabled: !!activePropertyId } });
  
  const { data: _rDataWrapper, isLoading: rLoading } = useListRooms(
    { propertyId: activePropertyId as number, limit: 1000 } as any,
    { query: { enabled: !!activePropertyId, queryKey: ["rooms", activePropertyId, 1000], staleTime: 0 } }
  );

  if (!activePropertyId) {
    return (
      <div className="p-8">
        <Alert>
          <Info className="w-4 h-4" />
          <AlertTitle>{ar ? "مطلوب" : "Required"}</AlertTitle>
          <AlertDescription>
            {ar ? "الرجاء اختيار فندق أولاً" : "Please select a hotel first"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (bLoading || fLoading || rLoading) {
    return <PageLoader />;
  }

  const buildings = (bData as any)?.data || bData || [];
  const floors = (fData as any)?.data || fData || [];
  const rData = (_rDataWrapper as any)?.data || _rDataWrapper || [];
  const rooms = Array.isArray(rData) ? rData : [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-none p-6 pb-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
            <Brush className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {ar ? "إدارة النظافة" : "Housekeeping"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {ar
                ? "متابعة وتحديث حالة تنظيف الغرف والصيانة"
                : "Monitor and update room housekeeping and maintenance status"}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <HousekeepingTab
          propertyId={activePropertyId}
          buildings={buildings}
          floors={floors}
          rooms={rooms}
        />
      </div>
    </div>
  );
}
