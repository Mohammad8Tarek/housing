import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Key,
  Wifi,
  WifiOff,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  getKeysQueryKey,
  useEncoderStatus,
  useIssueKey,
  useRevokeKey,
  useKeys,
  type EncoderType,
} from "@workspace/api-client-react";
import { Checkbox } from "@/components/ui/checkbox";

interface KeyManagementPanelProps {
  propertyId: number;
  roomId?: number;
  assignmentId?: number;
  profileId?: number;
  checkInDate?: string;
  checkOutDate?: string;
  defaultCardType?: string;
  notes?: string;
  onKeyIssued?: (key: any) => void;
  onIssueComplete?: (keys: any[]) => void;
  onIssuingChange?: (issuing: boolean) => void;
}

type IssuePhase =
  | "idle"
  | "encoding"
  | "confirming"
  | "waiting"
  | "done"
  | "error";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeCount(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(99, Math.max(1, Math.floor(value)));
}

export default function KeyManagementPanel({
  propertyId,
  roomId,
  assignmentId,
  profileId,
  checkInDate,
  checkOutDate,
  defaultCardType = "guest",
  notes,
  onKeyIssued,
  onIssueComplete,
  onIssuingChange,
}: KeyManagementPanelProps) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const ar = language === "ar";
  const [cardType, setCardType] = useState<string>(defaultCardType);
  const [manualCardNumber, setManualCardNumber] = useState("");
  const [useManualEntry, setUseManualEntry] = useState(false);
  const encoderType: EncoderType = "smart";
  const [workstationId, setWorkstationId] = useState(() => {
    return localStorage.getItem("hotek_workstation_id") || "WS1";
  });

  useEffect(() => {
    localStorage.setItem("hotek_workstation_id", workstationId);
  }, [workstationId]);

  const [numberOfCards, setNumberOfCards] = useState<number>(1);
  const [isIssuing, setIsIssuing] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [issuePhase, setIssuePhase] = useState<IssuePhase>("idle");
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issuedKeys, setIssuedKeys] = useState<any[]>([]);
  const [isDuplicateKey, setIsDuplicateKey] = useState(false);

  const { data: encoderStatus } = useEncoderStatus(encoderType, {
    query: { refetchInterval: 5000 },
  });
  const issueKeyMutation = useIssueKey();
  const revokeKeyMutation = useRevokeKey();
  const keysQuery = useKeys(propertyId, roomId);
  const existingKeys = keysQuery.data;

  const isEncoderConnected = encoderStatus?.connected ?? false;
  const requestedCount = useManualEntry ? 1 : normalizeCount(numberOfCards);
  const progressPercent =
    requestedCount > 0
      ? Math.round((currentCardIndex / requestedCount) * 100)
      : 0;

  const waitUntilKeyIsVisible = async (key: any) => {
    if (!roomId) return;

    const queryKey = getKeysQueryKey(propertyId, roomId);
    queryClient.setQueryData(queryKey, (old: any[] | undefined) => {
      if (!key?.id) return old ?? [];
      if (old?.some((item) => item.id === key.id)) return old;
      return [key, ...(old ?? [])];
    });

    for (let attempt = 0; attempt < 6; attempt++) {
      const result = await keysQuery.refetch();
      const found = result.data?.some((item: any) => {
        if (key?.id && item.id === key.id) return true;
        return key?.cardNumber && item.cardNumber === key.cardNumber;
      });

      if (found || !key?.id) return;
      await sleep(500);
    }

    await queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
  };

  const handleIssueKey = async () => {
    if (!roomId || isIssuing) return;

    setIssueError(null);
    setIssuedKeys([]);
    setIsIssuing(true);
    setIssuePhase("encoding");
    setCurrentCardIndex(0);
    onIssuingChange?.(true);

    const count = requestedCount;
    const createdKeys: any[] = [];
    let failed = false;

    for (let i = 0; i < count; i++) {
      setCurrentCardIndex(i + 1);
      setIssuePhase("encoding");

      try {
        const key = await issueKeyMutation.mutateAsync({
          propertyId,
          roomId,
          assignmentId,
          profileId,
          cardType,
          cardNumber: useManualEntry ? manualCardNumber.trim() : undefined,
          encodeCard: !useManualEntry,
          encoderType,
          workstationId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          notes,
          isDuplicate: isDuplicateKey || i > 0,
        });

        setIssuePhase("confirming");
        await waitUntilKeyIsVisible(key);

        createdKeys.push(key);
        setIssuedKeys([...createdKeys]);
        onKeyIssued?.(key);

        if (i < count - 1) {
          setIssuePhase("waiting");
          await sleep(3000);
        }
      } catch (err: any) {
        failed = true;
        setIssuePhase("error");
        setIssueError(
          err?.message ||
            (ar ? "حدث خطأ أثناء إصدار المفتاح" : "Failed to issue key"),
        );
        break;
      }
    }

    if (!failed && createdKeys.length === count) {
      setIssuePhase("done");
      onIssueComplete?.(createdKeys);
    } else if (failed) {
      // Keep issuePhase as "error" so the progress box stays visible
    } else {
      setIssuePhase("idle");
    }

    setIsIssuing(false);
    onIssuingChange?.(false);

    if (useManualEntry) {
      setManualCardNumber("");
    }
  };

  const handleRevokeKey = (keyId: number) => {
    revokeKeyMutation.mutate(
      { id: keyId, encoderType },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
        },
      },
    );
  };

  const showProgressBox =
    isIssuing ||
    issuePhase === "done" ||
    issuePhase === "error" ||
    issuedKeys.length > 0;

  const phaseTitle = (() => {
    if (issuePhase === "error") {
      return ar ? "توقف الإصدار بسبب خطأ" : "Issue halted due to error";
    }
    if (issuePhase === "done") {
      return ar
        ? `تم إصدار ${issuedKeys.length} مفتاح بنجاح`
        : `${issuedKeys.length} key(s) issued successfully`;
    }
    if (issuePhase === "confirming") {
      return ar
        ? `تمت كتابة المفتاح ${currentCardIndex}، جاري التأكد من ظهوره في النظام...`
        : `Key ${currentCardIndex} written, confirming it appears in the system...`;
    }
    if (issuePhase === "waiting") {
      return ar
        ? `تم إصدار المفتاح ${currentCardIndex}. ضع الكارت التالي الآن...`
        : `Key ${currentCardIndex} issued. Place the next card now...`;
    }
    return ar
      ? `جاري إصدار المفتاح ${currentCardIndex || 1} من ${requestedCount}...`
      : `Issuing key ${currentCardIndex || 1} of ${requestedCount}...`;
  })();

  const phaseDescription = (() => {
    if (issuePhase === "error") {
      return ar
        ? "يرجى التحقق من اتصال جهاز كتابة البطاقات وإعادة المحاولة."
        : "Please check the Encoder connection and try again.";
    }
    if (issuePhase === "done") {
      return ar
        ? "المفاتيح ظهرت في قائمة المفاتيح النشطة ويمكنك إغلاق النافذة الآن."
        : "The keys are visible in the active keys list. You can close the dialog now.";
    }
    if (issuePhase === "confirming") {
      return ar
        ? "ننتظر تحديث قاعدة البيانات وقائمة المفاتيح قبل الانتقال للخطوة التالية."
        : "Waiting for the database and key list to confirm before moving on.";
    }
    if (issuePhase === "waiting") {
      return ar
        ? "اسحب الكارت المكتمل وضع الكارت التالي على جهاز الإصدار."
        : "Remove the completed card and place the next card on the encoder.";
    }
    return ar
      ? "اترك الكارت على جهاز الإصدار حتى تنتهي الكتابة ويظهر المفتاح في النظام."
      : "Leave the card on the encoder until writing finishes and the key appears in the system.";
  })();

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Key className="h-4 w-4 text-amber-600" />
          {ar ? "إدارة المفاتيح" : "Key Management"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-white p-3">
          <div className="flex items-center gap-2">
            {isEncoderConnected ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-gray-400" />
            )}
            <div>
              <p className="text-xs font-medium">SMART Server</p>
              <p className="text-[10px] text-muted-foreground">
                {isEncoderConnected
                  ? "Online"
                  : ar
                    ? "غير متصل"
                    : "Disconnected"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_96px_96px_auto] items-end gap-2">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "نوع المفتاح" : "Key type"}
              </span>
              <Select
                value={cardType}
                onValueChange={setCardType}
                disabled={isIssuing}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guest">
                    {ar ? "ضيف" : "Guest Card"}
                  </SelectItem>
                  <SelectItem value="master">
                    {ar ? "رئيسي" : "Master Card"}
                  </SelectItem>
                  <SelectItem value="floor">
                    {ar ? "طابق" : "Floor Card"}
                  </SelectItem>
                  <SelectItem value="building">
                    {ar ? "مبنى" : "Building Card"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "جهاز الإصدار" : "Encoder"}
              </span>
              <Select
                value={workstationId}
                onValueChange={setWorkstationId}
                disabled={isIssuing || !isEncoderConnected}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WS1">
                    {ar ? "جهاز 1" : "Encoder 1"}
                  </SelectItem>
                  <SelectItem value="WS2">
                    {ar ? "جهاز 2" : "Encoder 2"}
                  </SelectItem>
                  <SelectItem value="WS3">
                    {ar ? "جهاز 3" : "Encoder 3"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!useManualEntry && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {ar ? "عدد المفاتيح" : "Key count"}
                </span>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={numberOfCards}
                  onChange={(e) =>
                    setNumberOfCards(normalizeCount(Number(e.target.value)))
                  }
                  disabled={isIssuing}
                  className="h-8 text-center text-xs"
                />
              </div>
            )}

            <Button
              onClick={handleIssueKey}
              disabled={
                isIssuing ||
                issueKeyMutation.isPending ||
                !roomId ||
                (useManualEntry && !manualCardNumber.trim()) ||
                (!useManualEntry && !isEncoderConnected)
              }
              className="h-8 bg-amber-600 text-xs hover:bg-amber-700"
            >
              {isIssuing || issueKeyMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Key className="mr-1 h-3 w-3" />
              )}
              {ar ? "إصدار" : "Issue"}
            </Button>
          </div>

          <div className="flex items-center space-x-2 rtl:space-x-reverse pt-1">
            <Checkbox
              id="duplicateKey"
              checked={isDuplicateKey}
              onCheckedChange={(checked) =>
                setIsDuplicateKey(checked as boolean)
              }
              disabled={isIssuing}
            />
            <label
              htmlFor="duplicateKey"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700"
            >
              {ar
                ? "إصدار كنسخة إضافية"
                : "Issue as Duplicate Key"}
            </label>
          </div>

          {showProgressBox && (
            <div
              className={`rounded-lg border p-3 transition-colors ${
                issuePhase === "done"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : issuePhase === "error"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : issuePhase === "waiting"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              <div className="flex items-start gap-2">
                {issuePhase === "done" ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : issuePhase === "error" ? (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <Loader2
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      issuePhase === "waiting"
                        ? "animate-pulse"
                        : "animate-spin"
                    }`}
                  />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-semibold">{phaseTitle}</p>
                  <p className="text-xs leading-relaxed opacity-90">
                    {phaseDescription}
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        issuePhase === "done"
                          ? "bg-green-600"
                          : issuePhase === "error"
                            ? "bg-red-600"
                            : issuePhase === "waiting"
                              ? "bg-amber-500"
                              : "bg-blue-600"
                      }`}
                      style={{
                        width: `${issuePhase === "done" ? 100 : issuePhase === "error" ? 100 : progressPercent}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {issueError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-xs font-medium leading-relaxed">
                {issueError}
              </div>
            </div>
          )}

          {useManualEntry && (
            <div className="flex gap-2">
              <Input
                placeholder={ar ? "رقم الكارت" : "Card Number"}
                value={manualCardNumber}
                onChange={(e) => setManualCardNumber(e.target.value)}
                disabled={isIssuing}
                className="h-8 text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUseManualEntry(false);
                  setManualCardNumber("");
                }}
                disabled={isIssuing}
                className="h-8 w-8 p-0"
              >
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
