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
  const { activePropertyId, properties } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";

  const effectivePropId = activePropertyId === "all" ? properties[0]?.id : activePropertyId;

  const { data: bData, isLoading: bLoading } = useListBuildings(
    {
      propertyId: effectivePropId as number,
      limit: 1000,
    } as any,
    {
      query: {
        queryKey: ["/api/buildings", effectivePropId],
        enabled: !!effectivePropId,
      },
    }
  );

  const { data: fData, isLoading: fLoading } = useListFloors(
    {
      propertyId: effectivePropId as number,
      limit: 1000,
    } as any,
    {
      query: {
        queryKey: ["/api/floors", effectivePropId],
        enabled: !!effectivePropId,
      },
    }
  );

  const { data: _rDataWrapper, isLoading: rLoading } = useListRooms(
    { propertyId: effectivePropId as number, limit: 1000 } as any,
    {
      query: {
        queryKey: ["/api/rooms", effectivePropId, 1000],
        enabled: !!effectivePropId,
        staleTime: 0,
      },
    }
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 shadow-xs">
            <Brush className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {ar ? "إدارة نظافة الغرف (الهاوس كيبنج)" : "Housekeeping & Room Cleaning"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {ar
                ? "متابعة وتحديث حالة نظافة الغرف وجاهزيتها للتسكين"
                : "Monitor room cleaning status, turnover and occupancy readiness"}
            </p>
          </div>
        </div>
      </div>

      {/* Direct Housekeeping Tab */}
      <HousekeepingTab
        propertyId={effectivePropId as number}
        buildings={buildings}
        floors={floors}
        rooms={rooms}
      />
    </div>
  );
}
