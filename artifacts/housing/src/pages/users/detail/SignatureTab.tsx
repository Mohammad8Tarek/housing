// User detail > Signature tab.
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Pen, Upload, Trash2, Check, RefreshCw } from "lucide-react";
import type { UserDetailPageState } from "./useUserDetailPageState";

export function renderSignatureTab(s: UserDetailPageState) {
  const { ar, signaturePreview, isUploadingSig, isDeletingSig, sigFileInputRef, handleUploadSig, handleDeleteSig } = s;
  return (
<div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Pen className="w-5 h-5 text-indigo-600" />
                {ar ? "التوقيع الرقمي للمستخدم" : "Digital Signature"}
              </CardTitle>
              <CardDescription>
                {ar
                  ? "يُستخدم هذا التوقيع الرقمي في أختام تصاريح استضافة الضيوف، أوامر الصيانة، وتقارير استلام وتسليم الغرف."
                  : "Applied on guest hosting approvals, maintenance sign-offs, and room handover records."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed bg-muted/20 text-center gap-4">
                {signaturePreview ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border shadow-sm max-w-sm mx-auto">
                      <img
                        src={signaturePreview}
                        alt="Signature Preview"
                        className="max-h-36 object-contain mx-auto"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:border-emerald-800 dark:text-emerald-400 font-semibold">
                        <Check className="w-3.5 h-3.5 me-1" />
                        {ar ? "التوقيع مسجل ومعتمد" : "Signature Registered"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteSig}
                        disabled={isDeletingSig}
                        className="text-red-600 hover:bg-red-50 border-red-200 text-xs"
                      >
                        {isDeletingSig ? <RefreshCw className="w-3.5 h-3.5 animate-spin me-1" /> : <Trash2 className="w-3.5 h-3.5 me-1" />}
                        {ar ? "حذف التوقيع" : "Delete Signature"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                      <Pen className="w-8 h-8 opacity-40" />
                    </div>
                    <h4 className="font-bold text-foreground">{ar ? "لا يوجد توقيع رقمي مسجل" : "No Signature Uploaded"}</h4>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {ar
                        ? "قم برفع صورة التوقيع بخلفية شفافة (PNG أو JPEG، بحد أقصى 2 ميجابايت) ليتم اعتمادها في المستندات."
                        : "Upload a transparent signature image (PNG/JPEG under 2MB)."}
                    </p>
                  </div>
                )}

                <div>
                  <input
                    ref={sigFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleUploadSig}
                    className="hidden"
                  />
                  <Button
                    onClick={() => sigFileInputRef.current?.click()}
                    disabled={isUploadingSig}
                    className="bg-[#0F2A44] hover:bg-[#18426a] text-white"
                  >
                    {isUploadingSig ? (
                      <RefreshCw className="w-4 h-4 animate-spin me-2" />
                    ) : (
                      <Upload className="w-4 h-4 me-2" />
                    )}
                    {signaturePreview
                      ? ar ? "استبدال صورة التوقيع" : "Replace Signature"
                      : ar ? "رفع صورة التوقيع الآن" : "Upload Signature Image"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
  );
}
