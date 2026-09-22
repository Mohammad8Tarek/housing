import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldAlert,
  Users,
  Clock,
  FileText,
  UserCheck,
  Building,
  Phone,
  Mail,
  Printer,
  Sparkles,
  HeartHandshake,
  Plus,
  Trash2,
  Pencil,
  Briefcase,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  Upload,
  Download,
  Bot,
  ShieldCheck,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  FileCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useFormContext } from "react-hook-form";
import type { SettingsFormData, JobLevelPolicy } from "../hooks/useSettingsForm";
import { DEFAULT_JOB_LEVEL_POLICIES } from "../hooks/useSettingsForm";
import { printLuxuryReport } from "@/pages/reports/utils/luxury-report-engine";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import { useProperty } from "@/context/PropertyContext";
import { useGetSettings } from "@workspace/api-client-react";
import { toast } from "sonner";

export interface SignatureStepItem {
  id?: string;
  stepOrder: number;
  roleRequired: string;
  labelAr: string;
  labelEn: string;
  description?: string;
}

export const DEFAULT_SIGNATURE_POLICY: SignatureStepItem[] = [
  {
    id: "step_1",
    stepOrder: 1,
    roleRequired: "housing_manager",
    labelAr: "مدير السكن",
    labelEn: "Housing Manager",
    description: "مراجعة وتسكين الطلب وتحديد الغرفة الملائمة",
  },
  {
    id: "step_2",
    stepOrder: 2,
    roleRequired: "hr_manager",
    labelAr: "مدير الموارد البشرية",
    labelEn: "Human Resources Manager",
    description: "اعتماد الأهلية والتحقق من صلة القرابة ورصيد الزيارات",
  },
  {
    id: "step_3",
    stepOrder: 3,
    roleRequired: "accounts_manager",
    labelAr: "المدير المالي / الحسابات",
    labelEn: "Accounts / Finance Manager",
    description: "الاعتماد المالي واحتساب الرسوم إن وجدت",
  },
];

export const PREDEFINED_ROLES = [
  { key: "housing_manager", ar: "مدير السكن", en: "Housing Manager" },
  { key: "hr_manager", ar: "مدير الموارد البشرية", en: "Human Resources Manager" },
  { key: "accounts_manager", ar: "المدير المالي / الحسابات", en: "Accounts / Finance Manager" },
  { key: "general_manager", ar: "المدير العام", en: "General Manager" },
  { key: "security_manager", ar: "مدير الأمن", en: "Security Manager" },
  { key: "super_admin", ar: "مسؤول النظام", en: "System Administrator" },
  { key: "custom", ar: "وظيفة مخصصة...", en: "Custom Job Title..." },
];

interface PoliciesSectionProps {
  propertyId?: number;
  language: string;
  isLoading: boolean;
  propertyName?: string;
}

export function PoliciesSection({
  propertyId,
  language,
  isLoading,
  propertyName,
}: PoliciesSectionProps) {
  const form = useFormContext<SettingsFormData>();
  const ar = language === "ar";
  const { properties, activeProperty } = useProperty();
  const currentPropId = propertyId ?? (typeof activeProperty?.id === "number" ? activeProperty.id : 1);
  const { data: settingsData } = useGetSettings({
    path: { propertyId: String(currentPropId) },
  });

  // Fetch job titles to map against custom rules
  const { data: existingJobTitles = [] } = useLookupValues(
    propertyId,
    LOOKUP_CATEGORIES.JOB_TITLE,
    true
  );

  // ── Signature Workflow Builder State & Handlers ──
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [stepForm, setStepForm] = useState<{
    roleRequired: string;
    labelAr: string;
    labelEn: string;
    description: string;
  }>({
    roleRequired: "housing_manager",
    labelAr: "",
    labelEn: "",
    description: "",
  });

  const rawSignaturePolicy: SignatureStepItem[] = form.watch("hostingRequestSignaturePolicy") || [];
  const currentSignaturePolicy: SignatureStepItem[] =
    rawSignaturePolicy.length > 0 ? rawSignaturePolicy : DEFAULT_SIGNATURE_POLICY;

  const handleOpenAddStep = () => {
    setEditingStepIndex(null);
    setStepForm({
      roleRequired: "housing_manager",
      labelAr: "مدير السكن",
      labelEn: "Housing Manager",
      description: "",
    });
    setIsStepModalOpen(true);
  };

  const handleOpenEditStep = (idx: number) => {
    const item = currentSignaturePolicy[idx];
    if (!item) return;
    setEditingStepIndex(idx);
    setStepForm({
      roleRequired: item.roleRequired,
      labelAr: item.labelAr,
      labelEn: item.labelEn,
      description: item.description || "",
    });
    setIsStepModalOpen(true);
  };

  const handleSaveStep = () => {
    const trimmedRole = stepForm.roleRequired.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const trimmedAr = stepForm.labelAr.trim();
    const trimmedEn = stepForm.labelEn.trim() || trimmedAr;

    if (!trimmedRole || !trimmedAr) {
      toast.error(ar ? "يرجى ملء المسمى بالعربية والوظيفة المطلوبة" : "Please specify Arabic title and required role");
      return;
    }

    const updated = [...currentSignaturePolicy];
    if (editingStepIndex !== null && editingStepIndex >= 0 && editingStepIndex < updated.length) {
      updated[editingStepIndex] = {
        ...updated[editingStepIndex],
        roleRequired: trimmedRole,
        labelAr: trimmedAr,
        labelEn: trimmedEn,
        description: stepForm.description.trim(),
      };
    } else {
      updated.push({
        id: `step_${Date.now()}`,
        stepOrder: updated.length + 1,
        roleRequired: trimmedRole,
        labelAr: trimmedAr,
        labelEn: trimmedEn,
        description: stepForm.description.trim(),
      });
    }

    const normalized = updated.map((s, i) => ({
      ...s,
      stepOrder: i + 1,
    }));

    form.setValue("hostingRequestSignaturePolicy", normalized, { shouldDirty: true, shouldValidate: true });
    setIsStepModalOpen(false);
    toast.success(
      editingStepIndex !== null
        ? (ar ? "تم تعديل خطوة الاعتماد" : "Signature step updated")
        : (ar ? "تمت إضافة خطوة الاعتماد بنجاح" : "Signature step added")
    );
  };

  const handleMoveStepUp = (idx: number) => {
    if (idx <= 0) return;
    const updated = [...currentSignaturePolicy];
    const temp = updated[idx];
    updated[idx] = updated[idx - 1];
    updated[idx - 1] = temp;
    const normalized = updated.map((s, i) => ({ ...s, stepOrder: i + 1 }));
    form.setValue("hostingRequestSignaturePolicy", normalized, { shouldDirty: true, shouldValidate: true });
  };

  const handleMoveStepDown = (idx: number) => {
    if (idx >= currentSignaturePolicy.length - 1) return;
    const updated = [...currentSignaturePolicy];
    const temp = updated[idx];
    updated[idx] = updated[idx + 1];
    updated[idx + 1] = temp;
    const normalized = updated.map((s, i) => ({ ...s, stepOrder: i + 1 }));
    form.setValue("hostingRequestSignaturePolicy", normalized, { shouldDirty: true, shouldValidate: true });
  };

  const handleDeleteStep = (idx: number) => {
    if (currentSignaturePolicy.length <= 1) {
      toast.error(ar ? "يجب الإبقاء على خطوة اعتماد واحدة على الأقل" : "At least one signature step is required");
      return;
    }
    const updated = currentSignaturePolicy.filter((_, i) => i !== idx);
    const normalized = updated.map((s, i) => ({ ...s, stepOrder: i + 1 }));
    form.setValue("hostingRequestSignaturePolicy", normalized, { shouldDirty: true, shouldValidate: true });
    toast.success(ar ? "تم حذف خطوة الاعتماد" : "Step deleted");
  };

  const handleResetWorkflow = () => {
    form.setValue("hostingRequestSignaturePolicy", DEFAULT_SIGNATURE_POLICY, { shouldDirty: true, shouldValidate: true });
    toast.success(ar ? "تمت استعادة المسار الافتراضي (3 خطوات)" : "Reset to default 3-step workflow");
  };

  // ─── Dynamic Level Policy States & Handlers ────────────────────────────────
  const [isAddLevelOpen, setIsAddLevelOpen] = useState(false);
  const [newLevelKey, setNewLevelKey] = useState("");
  const [newLevelNameEn, setNewLevelNameEn] = useState("");
  const [newLevelNameAr, setNewLevelNameAr] = useState("");
  const [newLevelCapacities, setNewLevelCapacities] = useState<number[]>([2, 3]);
  const [newLevelAllowEntire, setNewLevelAllowEntire] = useState(false);
  const [newLevelDescription, setNewLevelDescription] = useState("");

  const handleToggleCapacity = (levelId: string, bedNumber: number) => {
    const current = (form.getValues("jobLevelPolicies") && form.getValues("jobLevelPolicies").length > 0)
      ? form.getValues("jobLevelPolicies")
      : DEFAULT_JOB_LEVEL_POLICIES;

    const updated = current.map((item: JobLevelPolicy) => {
      if (item.id !== levelId) return item;
      const exists = item.allowedCapacities.includes(bedNumber);
      let newCapacities: number[];
      if (exists) {
        if (item.allowedCapacities.length <= 1) {
          toast.error(ar ? "يجب اختيار سعة سرير واحدة على الأقل" : "At least one bed capacity must be selected");
          return item;
        }
        newCapacities = item.allowedCapacities.filter((c) => c !== bedNumber);
      } else {
        newCapacities = [...item.allowedCapacities, bedNumber].sort((a, b) => a - b);
      }
      return { ...item, allowedCapacities: newCapacities };
    });
    form.setValue("jobLevelPolicies", updated, { shouldDirty: true, shouldValidate: true });
  };

  const handleToggleAllowEntire = (levelId: string, val: boolean) => {
    const current = (form.getValues("jobLevelPolicies") && form.getValues("jobLevelPolicies").length > 0)
      ? form.getValues("jobLevelPolicies")
      : DEFAULT_JOB_LEVEL_POLICIES;

    const updated = current.map((item: JobLevelPolicy) => {
      if (item.id !== levelId) return item;
      return { ...item, allowEntire: val };
    });
    form.setValue("jobLevelPolicies", updated, { shouldDirty: true, shouldValidate: true });
  };

  const handleDeleteLevel = (levelId: string) => {
    const current = (form.getValues("jobLevelPolicies") && form.getValues("jobLevelPolicies").length > 0)
      ? form.getValues("jobLevelPolicies")
      : DEFAULT_JOB_LEVEL_POLICIES;

    if (current.length <= 1) {
      toast.error(ar ? "يجب الإبقاء على مستوى واحد على الأقل في النظام" : "Must keep at least one level in the system");
      return;
    }
    const updated = current.filter((item: JobLevelPolicy) => item.id !== levelId);
    form.setValue("jobLevelPolicies", updated, { shouldDirty: true, shouldValidate: true });
    toast.success(ar ? "تم حذف المستوى بنجاح" : "Level removed successfully");
  };

  const handleAddLevel = () => {
    if (!newLevelNameEn.trim() && !newLevelNameAr.trim()) {
      toast.error(ar ? "يرجى كتابة اسم المستوى" : "Please enter level name");
      return;
    }
    if (newLevelCapacities.length === 0) {
      toast.error(ar ? "يرجى اختيار سعة سرير واحدة على الأقل" : "Please select at least one bed capacity");
      return;
    }
    const current = (form.getValues("jobLevelPolicies") && form.getValues("jobLevelPolicies").length > 0)
      ? form.getValues("jobLevelPolicies")
      : DEFAULT_JOB_LEVEL_POLICIES;

    const id = `level_${Date.now()}`;
    const key = newLevelKey.trim() || String(current.length);
    const newLevel: JobLevelPolicy = {
      id,
      levelKey: key,
      name: newLevelNameEn.trim() || `Level ${key}`,
      nameAr: newLevelNameAr.trim() || `المستوى ${key}`,
      allowedCapacities: [...newLevelCapacities].sort((a, b) => a - b),
      allowEntire: newLevelAllowEntire,
      description: newLevelDescription.trim() || undefined,
    };
    form.setValue("jobLevelPolicies", [...current, newLevel], { shouldDirty: true, shouldValidate: true });
    toast.success(ar ? "تم إضافة المستوى الجديد بنجاح" : "New level added successfully");
    setIsAddLevelOpen(false);
    setNewLevelKey("");
    setNewLevelNameEn("");
    setNewLevelNameAr("");
    setNewLevelCapacities([2, 3]);
    setNewLevelAllowEntire(false);
    setNewLevelDescription("");
  };

  const handleResetDefaultLevels = () => {
    form.setValue("jobLevelPolicies", DEFAULT_JOB_LEVEL_POLICIES, { shouldDirty: true, shouldValidate: true });
    toast.success(ar ? "تم استعادة المستويات الافتراضية (المستويات 0 إلى 4)" : "Default levels restored (Levels 0 through 4)");
  };

  // ─── Excel Template Export & Import States ──────────────────────────────────
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importData, setImportData] = useState<{
    levelCapacities: any[];
    customRules: any[];
    generalPolicies: any[];
  } | null>(null);

  const handleExportExcelTemplate = () => {
    const values = form.getValues();

    // 1. Level Capacities Sheet (Dynamic Job Level Policies)
    const currentLevels: JobLevelPolicy[] = (values.jobLevelPolicies && values.jobLevelPolicies.length > 0)
      ? values.jobLevelPolicies
      : DEFAULT_JOB_LEVEL_POLICIES;

    const levelCapacities = currentLevels.map((lvl) => ({
      "Level ID": lvl.id,
      "Level Key": lvl.levelKey,
      "Level Name (Ar)": lvl.nameAr,
      "Level Name (En)": lvl.name,
      "Allowed Capacities (Beds)": (lvl.allowedCapacities || [1]).join(", "),
      "Allow Entire Room": lvl.allowEntire ? "YES" : "NO",
      "Notes": lvl.description || "",
    }));

    // 2. Custom Rules Sheet
    const customRulesList = (values.customLevelRules || []).map((cr: any) => ({
      "Rule ID": cr.id,
      "Rule Name (En)": cr.name,
      "Rule Name (Ar)": cr.nameAr || cr.name,
      "Max Capacity (Beds)": Number(cr.capacity) || 5,
      "Allow Entire Room": cr.allowEntire ? "YES" : "NO",
      "Description": cr.description || "",
    }));

    // 3. General & Advanced Policies Sheet
    const generalPolicies = [
      {
        "Setting Key": "policyStrictGenderSegregation",
        "Policy Name (Ar)": "سياسة فصل الجنسين الصارمة",
        "Policy Name (En)": "Strict Gender Segregation",
        "Value (YES/NO/Number)": values.policyStrictGenderSegregation ? "YES" : "NO",
        "Description": "منع الاختلاط نهائياً في الغرف أو الأجنحة",
      },
      {
        "Setting Key": "policyStrictFamilySegregation",
        "Policy Name (Ar)": "سياسة سكن العائلات الصارمة",
        "Policy Name (En)": "Strict Family Segregation",
        "Value (YES/NO/Number)": values.policyStrictFamilySegregation ? "YES" : "NO",
        "Description": "حظر العزاب في أجنحة العائلات والعكس",
      },
      {
        "Setting Key": "policyAdaptiveLearning",
        "Policy Name (Ar)": "التعلم السلوكي الذكي لتوزيع الأقسام",
        "Policy Name (En)": "AI Adaptive Department Learning",
        "Value (YES/NO/Number)": values.policyAdaptiveLearning ? "YES" : "NO",
        "Description": "التعرف الذكي على قطاعات الأقسام وترشيح زملاء العمل معاً",
      },
      {
        "Setting Key": "policyRequireExceptionApproval",
        "Policy Name (Ar)": "إلزامية اعتماد استثناءات التسكين",
        "Policy Name (En)": "Require Exception Approval Workflow",
        "Value (YES/NO/Number)": values.policyRequireExceptionApproval ? "YES" : "NO",
        "Description": "إلزام تسجيل مسوغ إداري ومسؤول معتمد عند مخالفة أي سياسة",
      },
      {
        "Setting Key": "policyDepartmentClustering",
        "Policy Name (Ar)": "التجميع التلقائي حسب القسم",
        "Policy Name (En)": "Auto Department Clustering",
        "Value (YES/NO/Number)": values.policyDepartmentClustering ? "YES" : "NO",
        "Description": "تفضيل جمع موظفي القسم الواحد في غرف واحدة",
      },
      {
        "Setting Key": "policyStrictDepartmentSegregation",
        "Policy Name (Ar)": "فصل الأقسام الصارم",
        "Policy Name (En)": "Strict Department Segregation",
        "Value (YES/NO/Number)": values.policyStrictDepartmentSegregation ? "YES" : "NO",
        "Description": "منع خلط الأقسام نهائياً في نفس الغرفة",
      },
      {
        "Setting Key": "visitMaxNights",
        "Policy Name (Ar)": "الحد الأقصى لليالي الزيارة العائلية",
        "Policy Name (En)": "Max Nights Per Family Visit",
        "Value (YES/NO/Number)": values.visitMaxNights ?? 7,
        "Description": "أقصى عدد ليالٍ مسموح للزيارة الواحدة",
      },
      {
        "Setting Key": "visitMaxVisitsPerYear",
        "Policy Name (Ar)": "أقصى عدد زيارات عائلية سنوياً",
        "Policy Name (En)": "Max Family Visits Per Year",
        "Value (YES/NO/Number)": values.visitMaxVisitsPerYear ?? 2,
        "Description": "الحد الأقصى للزيارات العائلية في السنة",
      },
      {
        "Setting Key": "visitMinServiceMonths",
        "Policy Name (Ar)": "الحد الأدنى لخدمة الموظف (بالشهور)",
        "Policy Name (En)": "Min Service Months for Visit Eligibility",
        "Value (YES/NO/Number)": values.visitMinServiceMonths ?? 6,
        "Description": "الحد الأدنى لأقدمية الموظف لاستحقاق الزيارة",
      },
      {
        "Setting Key": "visitCooldownDays",
        "Policy Name (Ar)": "فترة التهدئة الفاصلة بين الزيارات (أيام)",
        "Policy Name (En)": "Visit Cooldown Days",
        "Value (YES/NO/Number)": values.visitCooldownDays ?? 90,
        "Description": "المدة الإلزامية الفاصلة بين زيارتين متتاليتين",
      },
      {
        "Setting Key": "visitRequireNationalId",
        "Policy Name (Ar)": "إلزامية الرقم القومي للمرافقين",
        "Policy Name (En)": "Mandatory National ID for Companions",
        "Value (YES/NO/Number)": values.visitRequireNationalId ? "YES" : "NO",
        "Description": "اشتراط إدخال الرقم القومي لإصدار تصريح الزيارة",
      },
      {
        "Setting Key": "curfewEnabled",
        "Policy Name (Ar)": "تفعيل موعد إغلاق البوابات (Curfew)",
        "Policy Name (En)": "Housing Curfew Active",
        "Value (YES/NO/Number)": values.curfewEnabled ? "YES" : "NO",
        "Description": "تفعيل وقت غلق البوابات الرسمية",
      },
      {
        "Setting Key": "curfewTime",
        "Policy Name (Ar)": "وقت موعد الإغلاق (ساعة:دقيقة)",
        "Policy Name (En)": "Curfew Time (HH:MM)",
        "Value (YES/NO/Number)": values.curfewTime || "23:00",
        "Description": "توقيت الإغلاق الليلي لبوابات السكن",
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsLevels = XLSX.utils.json_to_sheet(levelCapacities);
    const wsCustom = XLSX.utils.json_to_sheet(
      customRulesList.length
        ? customRulesList
        : [
            {
              "Rule ID": "rule_kitchen",
              "Rule Name (En)": "Kitchen Staff",
              "Rule Name (Ar)": "طاقم المطبخ",
              "Max Capacity (Beds)": 4,
              "Allow Entire Room": "NO",
              "Description": "قاعدة استحقاق سكن خاصة لطاقم المطبخ",
            },
          ]
    );
    const wsGeneral = XLSX.utils.json_to_sheet(generalPolicies);

    XLSX.utils.book_append_sheet(wb, wsLevels, "LevelCapacities");
    XLSX.utils.book_append_sheet(wb, wsCustom, "CustomRules");
    XLSX.utils.book_append_sheet(wb, wsGeneral, "GeneralPolicies");

    XLSX.writeFile(wb, `Housing_Policy_Template_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(
      ar ? "تم تصدير نموذج إكسيل للسياسات بنجاح" : "Housing policies template exported successfully"
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });

        let levelCapacities: any[] = [];
        if (wb.SheetNames.includes("LevelCapacities")) {
          levelCapacities = XLSX.utils.sheet_to_json(wb.Sheets["LevelCapacities"]);
        }

        let customRulesData: any[] = [];
        if (wb.SheetNames.includes("CustomRules")) {
          customRulesData = XLSX.utils.sheet_to_json(wb.Sheets["CustomRules"]);
        }

        let generalPoliciesData: any[] = [];
        if (wb.SheetNames.includes("GeneralPolicies")) {
          generalPoliciesData = XLSX.utils.sheet_to_json(wb.Sheets["GeneralPolicies"]);
        }

        setImportData({
          levelCapacities,
          customRules: customRulesData,
          generalPolicies: generalPoliciesData,
        });
      } catch (err: any) {
        toast.error(
          ar
            ? "فشل قراءة ملف الإكسيل. يرجى التأكد من تطابق الهيكل."
            : "Failed to parse Excel file. Check format."
        );
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = () => {
    if (!importData) return;

    let appliedCount = 0;

    // 1. Apply Level Capacities (Dynamic & Legacy)
    const importedLevels: JobLevelPolicy[] = [];
    for (const [idx, row] of importData.levelCapacities.entries()) {
      const key = String(row["Level Key"] || row["key"] || row["Key"] || idx).trim();
      const rawCaps = String(row["Allowed Capacities (Beds)"] || row["Max Capacity (Beds)"] || row["capacity"] || "1").trim();
      const parsedCaps = rawCaps
        .split(/[,،]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);
      const caps = parsedCaps.length > 0 ? parsedCaps : [1];
      const allowEnt = String(row["Allow Entire Room"] || "").toUpperCase().trim();
      const isEntire =
        allowEnt === "YES" || allowEnt === "TRUE" || allowEnt === "نعم" || allowEnt === "1";
      const nameEn = String(row["Level Name (En)"] || row["name"] || `Level ${key}`).trim();
      const nameAr = String(row["Level Name (Ar)"] || row["nameAr"] || `المستوى ${key}`).trim();
      const desc = String(row["Notes"] || row["Description"] || "").trim();

      importedLevels.push({
        id: String(row["Level ID"] || `level_${key || idx}`),
        levelKey: key.replace("policyLevel", "").replace("Capacity", "") || key,
        name: nameEn,
        nameAr: nameAr,
        allowedCapacities: caps,
        allowEntire: isEntire,
        description: desc || undefined,
      });

      if (key && !isNaN(caps[0])) {
        form.setValue(key as any, caps[0], { shouldDirty: true, shouldValidate: true });
      }
      appliedCount++;
    }

    if (importedLevels.length > 0) {
      form.setValue("jobLevelPolicies", importedLevels, { shouldDirty: true, shouldValidate: true });
    }

    // 2. Apply Custom Rules
    if (importData.customRules && importData.customRules.length > 0) {
      const parsedRules = importData.customRules.map((r: any, idx: number) => {
        const id = r["Rule ID"] || r["id"] || `imported_rule_${Date.now()}_${idx}`;
        const name = r["Rule Name (En)"] || r["name"] || `Rule ${idx + 1}`;
        const nameAr = r["Rule Name (Ar)"] || r["nameAr"] || name;
        const capacity = Number(r["Max Capacity (Beds)"] || r["capacity"]) || 5;
        const allowEnt = String(r["Allow Entire Room"] || "").toUpperCase().trim();
        const allowEntire =
          allowEnt === "YES" || allowEnt === "TRUE" || allowEnt === "نعم" || allowEnt === "1";
        const description = r["Description"] || r["description"] || "";
        return { id, name, nameAr, capacity, allowEntire, description };
      });
      form.setValue("customLevelRules", parsedRules, { shouldDirty: true, shouldValidate: true });
      appliedCount += parsedRules.length;
    }

    // 3. Apply General & Advanced Policies
    for (const row of importData.generalPolicies) {
      const key = row["Setting Key"] || row["key"] || row["Key"];
      const rawVal = row["Value (YES/NO/Number)"] ?? row["Value"] ?? row["value"];
      if (key && rawVal !== undefined) {
        const strVal = String(rawVal).toUpperCase().trim();
        const boolVal =
          strVal === "YES" || strVal === "TRUE" || strVal === "نعم" || strVal === "1";

        if (
          key === "policyStrictGenderSegregation" ||
          key === "policyStrictFamilySegregation" ||
          key === "policyAdaptiveLearning" ||
          key === "policyRequireExceptionApproval" ||
          key === "policyDepartmentClustering" ||
          key === "policyStrictDepartmentSegregation" ||
          key === "visitRequireNationalId" ||
          key === "curfewEnabled"
        ) {
          form.setValue(key as any, boolVal, { shouldDirty: true, shouldValidate: true });
          appliedCount++;
        } else if (
          key === "visitMaxNights" ||
          key === "visitMaxVisitsPerYear" ||
          key === "visitMinServiceMonths" ||
          key === "visitCooldownDays"
        ) {
          const numVal = Number(rawVal);
          if (!isNaN(numVal)) {
            form.setValue(key as any, numVal, { shouldDirty: true, shouldValidate: true });
            appliedCount++;
          }
        } else if (key === "curfewTime") {
          form.setValue("curfewTime", String(rawVal), { shouldDirty: true });
          appliedCount++;
        }
      }
    }

    toast.success(
      ar
        ? `تم استيراد ${appliedCount} إعداداً من السياسات بنجاح. انقر على 'حفظ الإعدادات' بالأسفل لتثبيت التغييرات.`
        : `Imported ${appliedCount} policy settings successfully. Click 'Save Settings' below to persist changes.`
    );
    setIsImportModalOpen(false);
    setImportData(null);
    setImportFileName("");
  };

  const handleExportPolicyPdf = () => {
    const values = form.getValues();
    const resolvedPropObj = properties.find((p) => p.id === (propertyId ?? activeProperty?.id));
    const propName = propertyName || resolvedPropObj?.displayName || resolvedPropObj?.name || (ar ? "سكن موظفي صن رايز" : "Sunrise Staff Housing");

    const policyContentHtml = `
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; font-family: inherit; line-height: 1.4; color: #1e293b; padding: 0;">
        <!-- Preamble Bar -->
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1.5px solid #cbd5e1; border-inline-start: 5px solid #C9A24D; padding: 8px 14px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div>
            <div style="font-size: 12.5px; font-weight: 800; color: #0F2A44; display: flex; align-items: center; gap: 6px;">
              <span>📜</span>
              <span>${ar ? "وثيقة ولائحة سياسات السكن الرسمية وضوابط الإقامة المعتمدة" : "Official Operational Regulations & Housing Code of Conduct"}</span>
            </div>
            <div style="font-size: 10.5px; color: #475569; margin-top: 3px; line-height: 1.45;">
              ${ar
                ? "لائحة مرجعية ملزمة إدارياً وقانونياً لكافة النزلاء والمقيمين بالسكن والعاملين والشركات والمتعاقدين والضيوف المصرح لهم بالإقامة."
                : "Official reference document binding for all housing residents, employees, contractors, and authorized visitors."
              }
            </div>
          </div>
          <div style="display: flex; gap: 6px; flex-shrink: 0;">
            <span style="font-size: 10.5px; background: #e2e8f0; color: #0F2A44; padding: 4px 10px; border-radius: 4px; font-weight: 800;">${propName}</span>
            <span style="font-size: 10.5px; background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 4px; font-weight: 800; border: 1px solid #bbf7d0;">${ar ? "سارية ومعتمدة" : "Enforced"}</span>
          </div>
        </div>

        <!-- 1. استحقاق السكن وتوزيع الغرف حسب الدرجة الوظيفية -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #C9A24D; padding-bottom: 4px; margin-bottom: 6px;">
            <h3 style="color: #0F2A44; font-size: 12.5px; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 6px;">
              <span>🏢</span>
              <span>${ar ? "1. استحقاق السكن وتوزيع الغرف حسب الدرجة الوظيفية (Allocation & Entitlements)" : "1. Room Allocation & Job Level Entitlements"}</span>
            </h3>
            <span style="font-size: 10.5px; font-weight: 700; color: #0284c7; background: #f0f9ff; padding: 2px 8px; border-radius: 4px; border: 1px solid #bae6fd;">
              ${values.policyDepartmentClustering ? (ar ? "✓ توحيد الأقسام مفعل" : "✓ Dept Clustering Active") : ""}
            </span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;">
            <thead>
              <tr style="background-color: #0F2A44; color: #ffffff;">
                <th style="padding: 6px 10px; text-align: start; font-weight: 800; width: 38%; border: 1px solid #0F2A44;">${ar ? "الدرجة الوظيفية" : "Job Level"}</th>
                <th style="padding: 6px 10px; text-align: center; font-weight: 800; width: 32%; border: 1px solid #0F2A44;">${ar ? "الحد الأقصى للأفراد بالغرفة" : "Max Room Capacity"}</th>
                <th style="padding: 6px 10px; text-align: center; font-weight: 800; width: 30%; border: 1px solid #0F2A44;">${ar ? "إمكانية حجز غرفة كاملة (Single)" : "Entire Room Allowance"}</th>
              </tr>
            </thead>
            <tbody>
              ${((values.jobLevelPolicies && values.jobLevelPolicies.length > 0)
                ? values.jobLevelPolicies
                : DEFAULT_JOB_LEVEL_POLICIES
              ).map((lvl: any, idx: number) => `
                <tr style="background-color: ${lvl.levelKey === "0" ? "#fffbeb" : (idx % 2 === 1 ? "#f8fafc" : "#ffffff")};">
                  <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">
                    <strong style="color: ${lvl.levelKey === "0" ? "#b45309" : "#0F2A44"}; font-size: 11px;">${ar ? (lvl.nameAr || lvl.name) : (lvl.name || lvl.nameAr)}</strong>
                    <span style="font-size: 9.5px; color:#64748b; margin-${ar ? "right" : "left"}: 4px;">(${lvl.levelKey ? `Level ${lvl.levelKey}` : ""})</span>
                  </td>
                  <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; text-align: center; color: #1e293b;">${(lvl.allowedCapacities || [1]).join(" ، ")} ${ar ? "سرير بالغرفة" : "beds in room"}</td>
                  <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center;">
                    ${lvl.allowEntire 
                      ? `<span style="background: #dcfce7; color: #166534; font-weight: 700; padding: 2px 8px; border-radius: 4px; font-size: 10px; border: 1px solid #bbf7d0;">${ar ? "مسموح (غرفة كاملة Single)" : "Allowed (Entire Room)"}</span>` 
                      : `<span style="background: #f1f5f9; color: #475569; font-weight: 600; padding: 2px 8px; border-radius: 4px; font-size: 10px;">${ar ? "تسكين مشترك (Shared Bed)" : "Shared Only"}</span>`
                    }
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          ${values.policyStrictDepartmentSegregation ? `
            <div style="font-size: 9.5px; color: #b91c1c; font-weight: 700; margin-top: 3px; display: flex; align-items: center; gap: 4px;">
              <span>⚠️</span>
              <span>${ar ? "تنبيه صارم: يُمنع نهائياً تسكين أقسام مختلفة في نفس الغرفة." : "Strict segregation: Different departments in the same room are strictly prohibited."}</span>
            </div>` : ""}
        </div>

        <!-- 2-Column Grid for Policies (Sections 2, 3, 4, 5) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <!-- Left Column -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <!-- 2. سياسة وضوابط الزيارات العائلية -->
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 9px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <h4 style="color: #0F2A44; font-size: 11.5px; font-weight: 800; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 6px 0; display: flex; align-items: center; gap: 6px;">
                <span>👨‍👩‍👧</span>
                <span>${ar ? "2. سياسة وضوابط الزيارات العائلية" : "2. Family Visit Policy & Rules"}</span>
              </h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; font-size: 10px; color: #334155; line-height: 1.55;">
                <div>• ${ar ? "الحد الأقصى للزيارة:" : "Max nights:"} <strong>${values.visitMaxNights} ${ar ? "ليالٍ" : "nights"}</strong></div>
                <div>• ${ar ? "الحد الأقصى سنوياً:" : "Max visits/yr:"} <strong>${values.visitMaxVisitsPerYear} ${ar ? "مرات" : "visits"}</strong></div>
                <div>• ${ar ? "الحد الأدنى للخدمة:" : "Min service:"} <strong>${values.visitMinServiceMonths} ${ar ? "أشهر" : "months"}</strong></div>
                <div>• ${ar ? "فترة التهدئة بين الزيارات:" : "Cooldown:"} <strong>${values.visitCooldownDays} ${ar ? "يوماً" : "days"}</strong></div>
                <div style="grid-column: span 2;">• ${ar ? "إثبات هوية المرافقين:" : "Companions ID:"} <strong>${values.visitRequireNationalId ? `<span style="color:#0284c7; font-weight:700;">${ar ? "إلزامي لكافة الأفراد والمرافقين" : "Mandatory for all"}</span>` : (ar ? "اختياري" : "Optional")}</strong></div>
              </div>
              ${values.familyVisitPolicyText ? `<div style="background:#f8fafc; padding:6px 9px; border-inline-start:3px solid #C9A24D; font-size:9.5px; margin-top:6px; border-radius:4px; line-height:1.45; color:#334155;">${values.familyVisitPolicyText}</div>` : ""}
            </div>

            <!-- 4. سياسة فصل الجنسين وسكن العائلات الصارمة -->
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 9px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <h4 style="color: #0F2A44; font-size: 11.5px; font-weight: 800; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 6px 0; display: flex; align-items: center; gap: 6px;">
                <span>🛡️</span>
                <span>${ar ? "4. فصل الجنسين وسكن العائلات الصارم" : "4. Strict Gender & Family Segregation"}</span>
              </h4>
              <div style="font-size: 10px; color: #334155; display: flex; flex-direction: column; gap: 5px; line-height: 1.55;">
                <div>• ${ar ? "فصل الجنسين بالكامل:" : "Gender Segregation:"} <strong>${values.policyStrictGenderSegregation ? `<span style="color:#16a34a; font-weight:700;">${ar ? "مفعل وصارم (حظر الخلط نهائياً)" : "Enforced (Strict)"}</span>` : (ar ? "تنبيهي" : "Advisory")}</strong></div>
                <div>• ${ar ? "سكن وأجنحة العائلات:" : "Family Suites:"} <strong>${values.policyStrictFamilySegregation ? `<span style="color:#16a34a; font-weight:700;">${ar ? "مفعل وصارم (حظر سكن العزاب)" : "Enforced (Strict)"}</span>` : (ar ? "تنبيهي" : "Advisory")}</strong></div>
              </div>
            </div>
          </div>

          <!-- Right Column -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <!-- 3. لائحة السكن ومواعيد الإغلاق -->
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 9px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <h4 style="color: #0F2A44; font-size: 11.5px; font-weight: 800; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 6px 0; display: flex; align-items: center; gap: 6px;">
                <span>⏰</span>
                <span>${ar ? "3. لائحة السكن ومواعيد الإغلاق (Curfew)" : "3. Housing Rules & Curfew"}</span>
              </h4>
              <div style="font-size: 10px; color: #334155; margin-bottom: 4px; line-height: 1.55;">
                • ${ar ? "إغلاق البوابات وحظر الدخول (Curfew):" : "Curfew Policy:"}
                ${values.curfewEnabled ? `<strong style="color:#b91c1c; font-weight:800;">${ar ? `مفعل — يغلق تمام الساعة ${values.curfewTime}` : `Enabled at ${values.curfewTime}`}</strong>` : `<strong>${ar ? "مفتوح على مدار الساعة (24/7)" : "Open 24/7"}</strong>`}
              </div>
              ${values.housingRulesText ? `<div style="background:#f8fafc; padding:6px 9px; border-inline-start:3px solid #0F2A44; font-size:9.5px; border-radius:4px; line-height:1.45; margin-top:5px; color:#334155;">${values.housingRulesText}</div>` : ""}
              ${values.housingPolicyText ? `<div style="background:#fffbeb; padding:6px 9px; border-inline-start:3px solid #f59e0b; font-size:9.5px; border-radius:4px; line-height:1.45; margin-top:5px; color:#334155;">${values.housingPolicyText}</div>` : ""}
            </div>

            <!-- 5. الحوكمة واعتماد الاستثناءات الإدارية والتعلم الذكي -->
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 9px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              <h4 style="color: #0F2A44; font-size: 11.5px; font-weight: 800; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 6px 0; display: flex; align-items: center; gap: 6px;">
                <span>🤖</span>
                <span>${ar ? "5. الحوكمة واعتماد الاستثناءات والذكاء الاصطناعي" : "5. Governance & AI Adaptive Learning"}</span>
              </h4>
              <div style="font-size: 10px; color: #334155; display: flex; flex-direction: column; gap: 5px; line-height: 1.55;">
                <div>• ${ar ? "اعتماد الاستثناءات الإدارية:" : "Exception Approvals:"} <strong>${values.policyRequireExceptionApproval ? `<span style="color:#0284c7; font-weight:700;">${ar ? "إلزامي ومسجل رسمياً بالسجل" : "Mandatory Logged"}</span>` : (ar ? "اختياري" : "Optional")}</strong></div>
                <div>• ${ar ? "التعلم الذكي لتسكين الأقسام:" : "AI Adaptive Learning:"} <strong>${values.policyAdaptiveLearning ? `<span style="color:#0284c7; font-weight:700;">${ar ? "مفعل (تسكين ذكي مستمر)" : "Active"}</span>` : (ar ? "معطل" : "Disabled")}</strong></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 6. مسؤولو التواصل والطوارئ (Horizontal Strip) -->
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 8px 12px;">
          <div style="color: #0F2A44; font-size: 11px; font-weight: 800; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>📞</span>
            <span>${ar ? "مسؤولو التواصل والإبلاغ عن المخالفات والطوارئ بالسكن" : "Emergency & Housing Operations Key Contacts"}</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 10px;">
            ${values.hrContact1Name ? `<div style="background:#ffffff; padding:6px 9px; border-radius:5px; border:1px solid #cbd5e1; line-height:1.45; box-shadow:0 1px 2px rgba(0,0,0,0.02);"><strong style="color:#0F2A44; font-size:10px;">${values.hrContact1Title || (ar ? "مدير الموارد البشرية" : "HR Director")}:</strong><br/><span style="font-weight:700; color:#1e293b;">${values.hrContact1Name}</span><br/><span style="color:#0284c7; font-weight:800; font-family:monospace; direction:ltr; display:inline-block; margin-top:2px;">📞 ${values.hrContact1Phone || ""}</span></div>` : ""}
            ${values.hrContact2Name ? `<div style="background:#ffffff; padding:6px 9px; border-radius:5px; border:1px solid #cbd5e1; line-height:1.45; box-shadow:0 1px 2px rgba(0,0,0,0.02);"><strong style="color:#0F2A44; font-size:10px;">${values.hrContact2Title || (ar ? "منسق الموارد البشرية" : "HR Coordinator")}:</strong><br/><span style="font-weight:700; color:#1e293b;">${values.hrContact2Name}</span><br/><span style="color:#0284c7; font-weight:800; font-family:monospace; direction:ltr; display:inline-block; margin-top:2px;">📞 ${values.hrContact2Phone || ""}</span></div>` : ""}
            ${values.housingManager1Name ? `<div style="background:#ffffff; padding:6px 9px; border-radius:5px; border:1px solid #cbd5e1; line-height:1.45; box-shadow:0 1px 2px rgba(0,0,0,0.02);"><strong style="color:#0F2A44; font-size:10px;">${values.housingManager1Title || (ar ? "مدير السكن" : "Housing Manager")}:</strong><br/><span style="font-weight:700; color:#1e293b;">${values.housingManager1Name}</span><br/><span style="color:#0284c7; font-weight:800; font-family:monospace; direction:ltr; display:inline-block; margin-top:2px;">📞 ${values.housingManager1Phone || ""}</span></div>` : ""}
            ${values.housingManager2Name ? `<div style="background:#ffffff; padding:6px 9px; border-radius:5px; border:1px solid #cbd5e1; line-height:1.45; box-shadow:0 1px 2px rgba(0,0,0,0.02);"><strong style="color:#0F2A44; font-size:10px;">${values.housingManager2Title || (ar ? "مساعد مدير السكن" : "Asst Housing Mgr")}:</strong><br/><span style="font-weight:700; color:#1e293b;">${values.housingManager2Name}</span><br/><span style="color:#0284c7; font-weight:800; font-family:monospace; direction:ltr; display:inline-block; margin-top:2px;">📞 ${values.housingManager2Phone || ""}</span></div>` : ""}
          </div>
        </div>
      </div>
    `;

    printLuxuryReport({
      title: ar ? "وثيقة ولائحة سياسات السكن الرسمية" : "Official Housing Policy & Code of Conduct",
      titleAr: "وثيقة ولائحة سياسات السكن الرسمية",
      subtitle: propName,
      subtitleAr: propName,
      propId: currentPropId,
      activePropertyId: currentPropId,
      properties: properties,
      settings: (settingsData || {}) as any,
      language: ar ? "ar" : "en",
      orientation: "portrait",
      singlePage: true,
      showKpis: false,
      showSignatures: true,
      signatures: {
        role1: "Housing Manager",
        role1Ar: "مدير السكن",
        role2: "Human Resources Director",
        role2Ar: "مدير الموارد البشرية",
        role3: "General Manager",
        role3Ar: "المدير العام",
      },
      rows: [],
      customSectionsHtml: policyContentHtml,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Export & Import Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {ar ? "سياسات ولوائح السكن والمحددات الإدارية" : "Housing Policies, Regulations & Allocation Rules"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar
              ? "يتبع النظام هذه القواعد تلقائياً في التسكين والبحث عن الغرف المناسبة واحتساب المخالفات لكل عقار"
              : "The system enforces these rules automatically during room allocations, matching, and violation audits"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={handleExportExcelTemplate}
            variant="outline"
            className="gap-1.5 border-emerald-600/40 hover:bg-emerald-50 text-emerald-700 dark:text-emerald-300 font-semibold text-xs shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {ar ? "تصدير نموذج إكسيل" : "Export Excel Template"}
          </Button>

          <Button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
            className="gap-1.5 border-blue-600/40 hover:bg-blue-50 text-blue-700 dark:text-blue-300 font-semibold text-xs shadow-xs"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            {ar ? "استيراد من إكسيل" : "Import from Excel"}
          </Button>

          <Button
            type="button"
            onClick={handleExportPolicyPdf}
            variant="outline"
            className="gap-1.5 border-primary/30 hover:bg-primary/5 text-primary font-semibold text-xs shadow-xs"
          >
            <Printer className="w-4 h-4" />
            {ar ? "وثيقة السياسات (PDF)" : "Export Policy PDF"}
          </Button>
        </div>
      </div>

      {/* Policies Internal Tabs */}
      <Tabs defaultValue="allocation" className="w-full space-y-4">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 h-auto p-1.5 bg-muted/60 border rounded-xl gap-1.5 shadow-xs">
          <TabsTrigger
            value="allocation"
            className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <Building className="w-4 h-4 text-primary" />
            <span>{ar ? "استحقاق الغرف والدرجات" : "Room & Level Allocation"}</span>
          </TabsTrigger>

          <TabsTrigger
            value="family_visits"
            className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-pink-600 data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <HeartHandshake className="w-4 h-4 text-pink-500" />
            <span>{ar ? "الزيارات العائلية" : "Family Visits"}</span>
          </TabsTrigger>

          <TabsTrigger
            value="rules"
            className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-amber-600 data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <Clock className="w-4 h-4 text-amber-500" />
            <span>{ar ? "المواعيد واللوائح" : "Rules & Curfew"}</span>
          </TabsTrigger>

          <TabsTrigger
            value="contacts"
            className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <UserCheck className="w-4 h-4 text-indigo-500" />
            <span>{ar ? "مسؤولو السكن والـ HR" : "Key Contacts & Admin"}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Allocation Rules & Level Entitlements */}
        <TabsContent value="allocation" className="space-y-4 focus-visible:outline-none">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building className="w-4 h-4 text-primary" />
                  {ar ? "1. سياسة استحقاق السكن والدرجات الوظيفية (Allocation Rules)" : "1. Job Level Entitlements & Department Rules"}
                </CardTitle>
                <CardDescription>
                  {ar
                    ? "تحديد سعة الغرف المسموحة لكل درجة وظيفية (تخصيص أعداد الأسرة المسموحة بالغرفة) وإمكانية حجز غرفة كاملة"
                    : "Customize allowed room bed capacities and full-room booking privileges per job level"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleResetDefaultLevels}
                  className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {ar ? "استعادة الافتراضي" : "Reset Defaults"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsAddLevelOpen(true)}
                  className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" />
                  {ar ? "إضافة مستوى جديد" : "Add Level"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dynamic Job Level Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {((form.watch("jobLevelPolicies") && form.watch("jobLevelPolicies").length > 0)
                  ? form.watch("jobLevelPolicies")
                  : DEFAULT_JOB_LEVEL_POLICIES
                ).map((lvl: JobLevelPolicy, index: number) => {
                  const isL0 = lvl.levelKey === "0" || lvl.id === "level_0";
                  const isL1 = lvl.levelKey === "1" || lvl.id === "level_1";
                  const isL2 = lvl.levelKey === "2" || lvl.id === "level_2";
                  const isL3 = lvl.levelKey === "3" || lvl.id === "level_3";
                  const isL4 = lvl.levelKey === "4" || lvl.id === "level_4";

                  const badgeBg = isL0
                    ? "bg-amber-500 text-white border-amber-600 font-bold"
                    : isL1
                    ? "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400"
                    : isL2
                    ? "bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-400"
                    : isL3
                    ? "bg-indigo-500/10 text-indigo-700 border-indigo-300 dark:text-indigo-400"
                    : isL4
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400"
                    : "bg-purple-500/10 text-purple-700 border-purple-300 dark:text-purple-400";

                  const cardBorder = isL0
                    ? "border-amber-300/80 bg-amber-500/5 dark:border-amber-700/60"
                    : "border-border bg-card hover:border-primary/40";

                  const sortedCapacities = [...(lvl.allowedCapacities || [1])].sort((a, b) => a - b);

                  return (
                    <div
                      key={lvl.id || `level_${index}`}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between shadow-xs ${cardBorder}`}
                    >
                      <div className="space-y-3">
                        {/* Level Header: Badge + Delete Button */}
                        <div className="flex items-center justify-between gap-1.5">
                          <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${badgeBg}`}>
                            {isL0 ? "Level 0 ★" : `Level ${lvl.levelKey || index}`}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteLevel(lvl.id)}
                            title={ar ? "حذف هذا المستوى" : "Delete level"}
                            className="h-6 w-6 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {/* Level Title & Subtitle */}
                        <div>
                          <div className="text-xs font-bold leading-snug line-clamp-1">
                            {ar ? lvl.nameAr || lvl.name : lvl.name || lvl.nameAr}
                          </div>
                          <div className="text-[10px] text-muted-foreground leading-normal mt-0.5 line-clamp-2">
                            {lvl.description || (ar ? lvl.name : lvl.nameAr)}
                          </div>
                        </div>

                        {/* Multi-Capacity Customization */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-muted-foreground">
                              {ar ? "سعات الأسرة:" : "Bed Capacities:"}
                            </span>
                            <span className="font-bold text-primary text-[11px]">
                              {sortedCapacities.join(" ، ")} {ar ? "سرير" : "beds"}
                            </span>
                          </div>

                          {/* Capacity Selectable Chips 1..8 */}
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((bed) => {
                              const isSelected = lvl.allowedCapacities.includes(bed);
                              return (
                                <button
                                  key={bed}
                                  type="button"
                                  onClick={() => handleToggleCapacity(lvl.id, bed)}
                                  className={`text-[11px] font-bold py-1 px-1.5 rounded-md border transition-all flex items-center justify-center gap-0.5 ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary shadow-2xs scale-[1.02]"
                                      : "bg-background text-muted-foreground hover:bg-muted/70 border-muted/50 hover:text-foreground"
                                  }`}
                                  title={`${bed} ${ar ? "سرير بالغرفة" : "beds in room"}`}
                                >
                                  {isSelected ? "✓" : ""} {bed}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Footer: Allow Entire Room Switch */}
                      <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center justify-between">
                        <div className="space-y-0.5 pe-2">
                          <span className="text-[11px] font-bold block leading-tight">
                            {ar ? "غرفة كاملة" : "Entire Room"}
                          </span>
                          <span className="text-[9.5px] text-muted-foreground block leading-tight">
                            {lvl.allowEntire ? (ar ? "مسموح (فردي)" : "Allowed") : (ar ? "مشترك فقط" : "Shared")}
                          </span>
                        </div>
                        <Switch
                          checked={lvl.allowEntire}
                          onCheckedChange={(val) => handleToggleAllowEntire(lvl.id, val)}
                          className="scale-85"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              {/* Department Clustering & Segregation Policies */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="policyDepartmentClustering"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          {ar ? "التجميع التلقائي حسب القسم (Department Clustering)" : "Auto Department Clustering"}
                        </FormLabel>
                        <FormDescription className="text-[11px]">
                          {ar
                            ? "النظام يختار ويبحث تلقائياً عن الغرف التي يتواجد بها زملاء من نفس القسم (مثل عمال الـ Housekeeping معاً)"
                            : "Prioritize & auto-recommend rooms housing colleagues from the same department"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyStrictDepartmentSegregation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                          {ar ? "منع خلط الأقسام نهائياً (Strict Segregation)" : "Strict Department Segregation"}
                        </FormLabel>
                        <FormDescription className="text-[11px]">
                          {ar
                            ? "منع تسكين أي موظف في غرفة بها موظف من قسم آخر وظهور استثناء للمشرف"
                            : "Disallow mixing employees of different departments in the same room"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyStrictGenderSegregation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-pink-50/50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5 text-pink-900 dark:text-pink-300">
                          <ShieldAlert className="w-3.5 h-3.5 text-pink-600" />
                          {ar ? "سياسة فصل الجنسين الصارمة (Strict Gender Segregation)" : "Strict Gender Segregation"}
                        </FormLabel>
                        <FormDescription className="text-[11px] text-pink-950/70 dark:text-pink-300/70">
                          {ar
                            ? "منع منعاً باتاً تسكين موظف وموظفة في نفس الغرفة المشتركة أو حجز غرفة مخصصة للجنس الآخر"
                            : "Strictly prohibit mixed-gender shared accommodation or cross-gender wing allocation"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyStrictFamilySegregation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300">
                          <HeartHandshake className="w-3.5 h-3.5 text-indigo-600" />
                          {ar ? "سياسة سكن العائلات الصارمة (Strict Family Segregation)" : "Strict Family Segregation"}
                        </FormLabel>
                        <FormDescription className="text-[11px] text-indigo-950/70 dark:text-indigo-300/70">
                          {ar
                            ? "حظر تسكين الموظفين العزاب في أجنحة العائلات، وحظر تسكين عائلة في غرفة مشتركة مع عزاب إلا باستثناء معتمد"
                            : "Strictly reserve family suites for families; bachelors require approved exception"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyAdaptiveLearning"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5 text-blue-900 dark:text-blue-300">
                          <Bot className="w-3.5 h-3.5 text-blue-600" />
                          {ar ? "التعلم الذكي لتوزيع الأقسام (AI Adaptive Territory Learning)" : "AI Adaptive Department Learning"}
                        </FormLabel>
                        <FormDescription className="text-[11px] text-blue-950/70 dark:text-blue-300/70">
                          {ar
                            ? "يتعلم محرك التسكين سلوكياً قطاعات الأقسام (Housekeeping / F&B / مطبخ) ويرشح الغرف التي تجمع زملاء القسم تلقائياً"
                            : "Engine learns department territories dynamically and clusters colleagues together automatically"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyRequireExceptionApproval"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          {ar ? "حوكمة واعتماد استثناءات التسكين (Approval Workflow)" : "Require Exception Approval Workflow"}
                        </FormLabel>
                        <FormDescription className="text-[11px] text-amber-950/70 dark:text-amber-300/70">
                          {ar
                            ? "إلزامية فتح نموذج تسجيل رسمي لتسجيل المسوغ الإداري والجهة المعتمدة عند أي مخالفة لسياسات السكن"
                            : "Mandates formal approval dialog and logs justification & approving party for any policy override"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

    {/* Tab 2: Family Visit Policy */}
    <TabsContent value="family_visits" className="space-y-4 focus-visible:outline-none">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartHandshake className="w-4 h-4 text-pink-500" />
            {ar ? "2. سياسة وضوابط الزيارات العائلية (Family Visit Policy)" : "2. Family Visit Policy"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "ضوابط استحقاق مدد واستضافات عائلات الموظفين والاشتراطات الرسمية"
              : "Eligibility criteria, maximum duration, cooldown, and identity rules for family visits"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="visitMaxNights"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">{ar ? "الحد الأقصى لليالي الزيارة" : "Max Nights / Visit"}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={60} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">{ar ? "افتراضياً 7 ليالٍ" : "Default 7 nights"}</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visitMaxVisitsPerYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">{ar ? "الحد الأقصى للزيارات سنوياً" : "Max Visits / Year"}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={20} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">{ar ? "افتراضياً زيارتان سنوياً" : "Default 2 visits/year"}</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visitMinServiceMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">{ar ? "الحد الأدنى للخدمة (شهور)" : "Min Service (Months)"}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={60} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">{ar ? "أشهر خدمة قبل الاستحقاق" : "Months of service required"}</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visitCooldownDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">{ar ? "فترة التهدئة الفاصلة (أيام)" : "Cooldown Days"}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={365} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">{ar ? "الفاصل بين الزيارات" : "Days between visits"}</FormDescription>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="visitRequireNationalId"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card mt-2">
                <div className="space-y-0.5 pe-4">
                  <FormLabel className="text-xs font-bold">
                    {ar ? "إلزامية إدخال الرقم القومي لجميع أفراد الأسرة والمرافقين" : "Require National ID for All Family Companions"}
                  </FormLabel>
                  <FormDescription className="text-[11px]">
                    {ar
                      ? "عدم إتمام طلب الزيارة إلا بعد تسجيل الرقم القومي (14 رقماً) وإثبات صلة القرابة لكل فرد"
                      : "Mandates 14-digit National ID and relationship documentation for each companion"}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="familyVisitPolicyText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">{ar ? "نص وبنود لائحة الزيارات العائلية التفصيلية" : "Family Visit Policy Guidelines (Text)"}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={ar ? "أدخل نص التعليمات والاشتراطات الخاصة بالاستضافة العائلية..." : "Enter details for family hosting policy..."}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Signature & Approval Workflow Card */}
      <Card className="border-pink-500/20 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-pink-700 dark:text-pink-400">
              <FileCheck className="w-5 h-5 text-pink-600" />
              {ar
                ? "مسار واعتمادات طلبات السكن والاستضافة (Signature & Approval Workflow)"
                : "Hosting & Visit Approval Workflow"}
            </CardTitle>
            <CardDescription>
              {ar
                ? "تحديد تسلسل التوقيعات المطلوبة لطلبات السكن والاستضافة والزيارات العائلية الخاصة بهذا العقار، وإعادة ترتيبها أو إضافة جهات اعتماد جديدة"
                : "Configure the required signature chain, reorder approval stages, or add new approval roles for this property"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetWorkflow}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {ar ? "استعادة الافتراضي" : "Reset Default"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleOpenAddStep}
              className="gap-1.5 text-xs font-semibold bg-pink-600 hover:bg-pink-700 text-white"
            >
              <Plus className="w-4 h-4" />
              {ar ? "إضافة خطوة اعتماد" : "Add Approval Step"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-16 font-bold text-xs text-center">{ar ? "الترتيب" : "Order"}</TableHead>
                  <TableHead className="font-bold text-xs">{ar ? "المسمى العربي" : "Arabic Title"}</TableHead>
                  <TableHead className="font-bold text-xs">{ar ? "المسمى الإنجليزي" : "English Title"}</TableHead>
                  <TableHead className="font-bold text-xs">{ar ? "الوظيفة / الصلاحية المطلوبة" : "Required Role"}</TableHead>
                  <TableHead className="font-bold text-xs">{ar ? "ملاحظات المسار" : "Description"}</TableHead>
                  <TableHead className="font-bold text-xs text-end w-36">{ar ? "الإجراءات والترتيب" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentSignaturePolicy.map((step, idx) => (
                  <TableRow key={step.id || `step_${idx}`} className="hover:bg-muted/30">
                    <TableCell className="text-center font-bold">
                      <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center bg-pink-50 text-pink-700 border-pink-300">
                        {step.stepOrder}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {step.labelAr}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {step.labelEn}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px] bg-muted">
                        {step.roleRequired}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {step.description || "-"}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          disabled={idx === 0}
                          onClick={() => handleMoveStepUp(idx)}
                          title={ar ? "تقديم الخطوة لأعلى" : "Move Up"}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          disabled={idx === currentSignaturePolicy.length - 1}
                          onClick={() => handleMoveStepDown(idx)}
                          title={ar ? "تأخير الخطوة لأسفل" : "Move Down"}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleOpenEditStep(idx)}
                          title={ar ? "تعديل" : "Edit"}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          disabled={currentSignaturePolicy.length <= 1}
                          onClick={() => handleDeleteStep(idx)}
                          title={ar ? "حذف" : "Delete"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    {/* Tab 3: Housing Rules & Curfew */}
    <TabsContent value="rules" className="space-y-4 focus-visible:outline-none">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-amber-500" />
            {ar ? "3. قواعد السكن ومواعيد الإغلاق (Housing Rules & Curfew)" : "3. Housing Rules & Curfew"}
          </CardTitle>
          <CardDescription>
            {ar ? "تنظيم مواعيد الدخول والخروج ولائحة السلوك والتعليمات العامة" : "Regulate curfew times, code of conduct, and resident house rules"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="curfewEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                  <div className="space-y-0.5 pe-4">
                    <FormLabel className="text-xs font-bold">
                      {ar ? "تفعيل موعد إغلاق بوابات السكن (Curfew)" : "Enable Housing Curfew"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar ? "تسجيل تنبيه عند دخول الموظفين بعد الموعد المحدد" : "Trigger alerts for residents arriving after curfew"}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="curfewTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">{ar ? "ساعة الإغلاق المسائي" : "Curfew Cutoff Time"}</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">{ar ? "مثال: 23:00 (11 مساءً)" : "e.g., 23:00 (11:00 PM)"}</FormDescription>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="housingRulesText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">{ar ? "لائحة قواعد وسلوكيات السكن (Code of Conduct)" : "Housing Code of Conduct"}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder={ar ? "اكتب تعليمات الحفاظ على الهدوء، النظافة، السلامة، وممنوعات التدخين..." : "Specify rules regarding quiet hours, cleanliness, safety, smoking bans..."}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="housingPolicyText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">{ar ? "اللائحة العامة وتعهد النزيل (General Policy & Agreement)" : "General Policy & Agreement"}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={ar ? "نص الإقرار الذي يوقع عليه النزيل عند الاستلام والتسكين..." : "Agreement text signed upon check-in..."}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </TabsContent>

    {/* Tab 4: Key Contacts & Housing Management */}
    <TabsContent value="contacts" className="space-y-4 focus-visible:outline-none">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            {ar ? "4. مسؤولو الموارد البشرية وإدارة السكن (Key Contacts)" : "4. Key HR & Housing Contacts"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "يتم إظهار جهات الاتصال هذه في بوابة الموظفين المقيمين للاتصال السريع والتواصل المباشر"
              : "These contacts are displayed in the Resident Portal for instant WhatsApp, Call, and Email support"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* HR Contacts */}
          <div>
            <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 mb-3">
              <UserCheck className="w-3.5 h-3.5" />
              {ar ? "إدارة الموارد البشرية (HR Management)" : "HR Management"}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* HR Manager */}
              <div className="p-3.5 border rounded-lg bg-card space-y-3">
                <span className="text-[11px] font-bold text-primary uppercase">{ar ? "مدير الموارد البشرية" : "HR Manager"}</span>
                <FormField
                  control={form.control}
                  name="hrContact1Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "الاسم" : "Name"}</FormLabel>
                      <FormControl><Input placeholder={ar ? "اسم مدير الموارد البشرية" : "HR Manager Name"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="hrContact1Title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "المسمى الوظيفي" : "Title"}</FormLabel>
                        <FormControl><Input placeholder="HR Manager" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hrContact1Phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "الهاتف / واتساب" : "Phone/WhatsApp"}</FormLabel>
                        <FormControl><Input placeholder="+20 10..." {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="hrContact1Email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "البريد الإلكتروني" : "Email"}</FormLabel>
                      <FormControl><Input placeholder="hr@sunrise-resorts.com" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Assistant HR Manager */}
              <div className="p-3.5 border rounded-lg bg-card space-y-3">
                <span className="text-[11px] font-bold text-primary uppercase">{ar ? "مساعد مدير الموارد البشرية" : "Assistant HR Manager"}</span>
                <FormField
                  control={form.control}
                  name="hrContact2Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "الاسم" : "Name"}</FormLabel>
                      <FormControl><Input placeholder={ar ? "اسم مساعد مدير الموارد البشرية" : "Assistant HR Manager Name"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="hrContact2Title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "المسمى الوظيفي" : "Title"}</FormLabel>
                        <FormControl><Input placeholder="Assistant HR Manager" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hrContact2Phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "الهاتف / واتساب" : "Phone/WhatsApp"}</FormLabel>
                        <FormControl><Input placeholder="+20 10..." {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="hrContact2Email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "البريد الإلكتروني" : "Email"}</FormLabel>
                      <FormControl><Input placeholder="hr.support@sunrise-resorts.com" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Housing Managers */}
          <div>
            <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-3">
              <Building className="w-3.5 h-3.5" />
              {ar ? "إدارة السكن (Housing Management)" : "Housing Management"}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Housing Manager */}
              <div className="p-3.5 border rounded-lg bg-card space-y-3">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase">{ar ? "مدير السكن" : "Housing Manager"}</span>
                <FormField
                  control={form.control}
                  name="housingManager1Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "الاسم" : "Name"}</FormLabel>
                      <FormControl><Input placeholder={ar ? "اسم مدير السكن" : "Housing Manager Name"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="housingManager1Title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "المسمى الوظيفي" : "Title"}</FormLabel>
                        <FormControl><Input placeholder="Housing Manager" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="housingManager1Phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "الهاتف / واتساب" : "Phone/WhatsApp"}</FormLabel>
                        <FormControl><Input placeholder="+20 10..." {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="housingManager1Email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "البريد الإلكتروني" : "Email"}</FormLabel>
                      <FormControl><Input placeholder="housing@sunrise-resorts.com" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Assistant Housing Manager */}
              <div className="p-3.5 border rounded-lg bg-card space-y-3">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase">{ar ? "مساعد مدير السكن" : "Assistant Housing Manager"}</span>
                <FormField
                  control={form.control}
                  name="housingManager2Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "الاسم" : "Name"}</FormLabel>
                      <FormControl><Input placeholder={ar ? "اسم مساعد مدير السكن" : "Assistant Housing Manager Name"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="housingManager2Title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "المسمى الوظيفي" : "Title"}</FormLabel>
                        <FormControl><Input placeholder="Assistant Housing Manager" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="housingManager2Phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "الهاتف / واتساب" : "Phone/WhatsApp"}</FormLabel>
                        <FormControl><Input placeholder="+20 10..." {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="housingManager2Email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "البريد الإلكتروني" : "Email"}</FormLabel>
                      <FormControl><Input placeholder="housing.supervisor@sunrise-resorts.com" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>

    {/* Signature Step Edit/Add Modal */}
    <Dialog open={isStepModalOpen} onOpenChange={setIsStepModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileCheck className="w-5 h-5 text-pink-600" />
            {editingStepIndex !== null
              ? (ar ? "تعديل خطوة الاعتماد" : "Edit Signature Step")
              : (ar ? "إضافة خطوة اعتماد جديدة" : "Add Approval Step")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? "حدد الوظيفة المطلوبة للتوقيع والمسمى الرسمي الذي سيظهر في استمارة الاعتماد"
              : "Select the required approval role and the official title shown on vouchers"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "اختر من الوظائف الشائعة أو القائمة:" : "Quick Preset Role:"}
            </label>
            <select
              className="w-full h-9 px-3 rounded-md border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              value={
                PREDEFINED_ROLES.some((r) => r.key === stepForm.roleRequired)
                  ? stepForm.roleRequired
                  : "custom"
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setStepForm((prev) => ({ ...prev, roleRequired: "" }));
                } else {
                  const preset = PREDEFINED_ROLES.find((r) => r.key === val);
                  if (preset) {
                    setStepForm((prev) => ({
                      ...prev,
                      roleRequired: preset.key,
                      labelAr: preset.ar,
                      labelEn: preset.en,
                    }));
                  }
                }
              }}
            >
              <optgroup label={ar ? "الأدوار القياسية" : "Standard Roles"}>
                {PREDEFINED_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {ar ? `${r.ar} (${r.en})` : `${r.en} (${r.ar})`}
                  </option>
                ))}
              </optgroup>
              {existingJobTitles && existingJobTitles.length > 0 && (
                <optgroup label={ar ? "المسميات المسجلة بالنظام" : "Lookup Job Titles"}>
                  {existingJobTitles.map((jt: any) => (
                    <option key={jt.id || jt.value} value={jt.value}>
                      {ar ? jt.labelAr || jt.label : jt.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Role Required Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "كود / مفتاح الوظيفة (Role Key):" : "Role Key (System Identifier):"}
            </label>
            <Input
              placeholder="e.g. housing_manager, general_manager"
              value={stepForm.roleRequired}
              onChange={(e) =>
                setStepForm((prev) => ({ ...prev, roleRequired: e.target.value }))
              }
              className="font-mono text-xs"
            />
            <span className="text-[10px] text-muted-foreground block">
              {ar
                ? "يجب أن يطابق كود الدور أو المسمى الوظيفي للمستخدمين المصرح لهم بالتوقيع"
                : "Must match the user's role or job title identifier to allow signing"}
            </span>
          </div>

          {/* Arabic Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "المسمى الرسمي بالعربية:" : "Official Title (Arabic):"}
            </label>
            <Input
              placeholder="مثال: مدير السكن / مدير الموارد البشرية"
              value={stepForm.labelAr}
              onChange={(e) =>
                setStepForm((prev) => ({ ...prev, labelAr: e.target.value }))
              }
              className="text-xs"
            />
          </div>

          {/* English Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "المسمى الرسمي بالإنجليزية:" : "Official Title (English):"}
            </label>
            <Input
              placeholder="e.g. Housing Manager / HR Manager"
              value={stepForm.labelEn}
              onChange={(e) =>
                setStepForm((prev) => ({ ...prev, labelEn: e.target.value }))
              }
              className="text-xs"
            />
          </div>

          {/* Description / Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "ملاحظات وتوجيهات الخطوة (اختياري):" : "Step Notes / Guidance (Optional):"}
            </label>
            <Input
              placeholder={ar ? "مثال: مراجعة المستندات والأهلية..." : "e.g. Review documents and eligibility..."}
              value={stepForm.description}
              onChange={(e) =>
                setStepForm((prev) => ({ ...prev, description: e.target.value }))
              }
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsStepModalOpen(false)}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveStep}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {ar ? "حفظ الخطوة" : "Save Step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Import Policies from Excel Dialog */}
    <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-primary">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            {ar ? "استيراد وتحديث السياسات من ملف إكسيل" : "Import Policies from Excel"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? "قم برفع ملف الإكسيل المطابق للنموذج المعتمد لتحديث سعات الدرجات والقواعد المخصصة والسياسات العامة تلقائياً."
              : "Upload an Excel workbook formatted like the official template to import level capacities, custom rules, and policies."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Upload Zone */}
          <div className="border-2 border-dashed rounded-xl p-6 text-center space-y-2 hover:bg-muted/30 transition-colors bg-muted/10">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-xs font-semibold">
                {importFileName ||
                  (ar
                    ? "اختر ملف إكسيل (.xlsx أو .xls)"
                    : "Choose Excel file (.xlsx or .xls)")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {ar
                  ? "يمكنك استخدام زر 'تصدير نموذج إكسيل' لتعبئة البيانات المطلوبة"
                  : "You can download the template using the 'Export Excel Template' button"}
              </p>
            </div>
            <input
              type="file"
              accept=".xlsx, .xls"
              id="policy-excel-upload"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs mt-2"
              onClick={() =>
                document.getElementById("policy-excel-upload")?.click()
              }
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
              {ar ? "تصفح الملفات..." : "Browse files..."}
            </Button>
          </div>

          {/* Preview Summary */}
          {importData && (
            <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2 text-xs">
              <span className="font-bold flex items-center gap-1.5 text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {ar ? "ملخص البيانات المكتشفة في الملف:" : "Detected Excel Content:"}
              </span>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">
                    {ar ? "سعات الدرجات" : "Level Capacities"}
                  </span>
                  <span className="font-bold text-sm text-primary">
                    {importData.levelCapacities.length}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">
                    {ar ? "قواعد مخصصة" : "Custom Rules"}
                  </span>
                  <span className="font-bold text-sm text-primary">
                    {importData.customRules.length}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">
                    {ar ? "سياسات عامة" : "General Policies"}
                  </span>
                  <span className="font-bold text-sm text-primary">
                    {importData.generalPolicies.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsImportModalOpen(false);
              setImportData(null);
              setImportFileName("");
            }}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!importData}
            onClick={handleConfirmImport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {ar ? "تطبيق السياسات على الإعدادات" : "Apply to Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Add New Level Policy Modal */}
    <Dialog open={isAddLevelOpen} onOpenChange={setIsAddLevelOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-primary">
            <Plus className="w-5 h-5 text-primary" />
            {ar ? "إضافة مستوى وظيفي جديد للسياسات" : "Add New Job Level Policy"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? "تحديد كود المستوى، الاسم، وسعات الأسرة المسموحة للغرفة (يمكن اختيار أكثر من سعة)"
              : "Define level code, title, and customizable allowed bed capacities for accommodation"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">{ar ? "كود / رقم المستوى" : "Level Key / Code"}</Label>
              <Input
                value={newLevelKey}
                onChange={(e) => setNewLevelKey(e.target.value)}
                placeholder={ar ? "مثال: 5 أو VIP" : "e.g. 5 or VIP"}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold">{ar ? "الاسم بالعربية" : "Arabic Label"}</Label>
              <Input
                value={newLevelNameAr}
                onChange={(e) => setNewLevelNameAr(e.target.value)}
                placeholder={ar ? "مثال: المستوى 5 / مشرفين" : "e.g. Supervisors"}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">{ar ? "الاسم بالإنجليزية" : "English Name"}</Label>
            <Input
              value={newLevelNameEn}
              onChange={(e) => setNewLevelNameEn(e.target.value)}
              placeholder="e.g. Level 5 / Supervisors"
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">{ar ? "الوصف أو الملاحظات" : "Description / Notes"}</Label>
            <Input
              value={newLevelDescription}
              onChange={(e) => setNewLevelDescription(e.target.value)}
              placeholder={ar ? "مثال: متاح سكن ثنائي أو ثلاثي" : "e.g. 2 or 3 bed rooms"}
              className="mt-1 text-xs"
            />
          </div>

          {/* Allowed Bed Capacities Multi-Select */}
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <div className="flex items-center justify-between text-xs">
              <Label className="font-semibold text-foreground">
                {ar ? "سعات الأسرة المسموحة بالغرفة:" : "Allowed Bed Capacities:"}
              </Label>
              <span className="font-bold text-primary">
                {[...newLevelCapacities].sort((a, b) => a - b).join(" ، ")} {ar ? "سرير" : "beds"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "انقر لتحديد أو إلغاء تحديد السعات المسموح بها لهذا المستوى (مثل 2 و 3)"
                : "Click to toggle allowed capacities (e.g. 2 and 3 beds)"}
            </p>
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((bed) => {
                const isSelected = newLevelCapacities.includes(bed);
                return (
                  <button
                    key={bed}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        if (newLevelCapacities.length <= 1) {
                          toast.error(ar ? "يجب اختيار سعة واحدة على الأقل" : "Select at least one capacity");
                          return;
                        }
                        setNewLevelCapacities(newLevelCapacities.filter((c) => c !== bed));
                      } else {
                        setNewLevelCapacities([...newLevelCapacities, bed].sort((a, b) => a - b));
                      }
                    }}
                    className={`text-xs font-bold py-1.5 px-2 rounded-lg border transition-all flex items-center justify-center gap-1 ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs scale-[1.02]"
                        : "bg-background text-muted-foreground hover:bg-muted border-muted/50 hover:text-foreground"
                    }`}
                  >
                    {isSelected ? "✓" : ""} {bed} {ar ? "سرير" : "beds"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allow Entire Room Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="space-y-0.5 pe-4">
              <Label className="text-xs font-bold block">
                {ar ? "السماح بحجز غرفة كاملة (فردي)" : "Allow Full Room Booking (Single)"}
              </Label>
              <span className="text-[11px] text-muted-foreground block">
                {ar
                  ? "السماح للموظف بحجز غرفة بمفرده حتى لو كانت متعددة الأسرة"
                  : "Allow booking an entire room exclusively for this level"}
              </span>
            </div>
            <Switch
              checked={newLevelAllowEntire}
              onCheckedChange={setNewLevelAllowEntire}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddLevelOpen(false)}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAddLevel}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {ar ? "إضافة المستوى" : "Add Level"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
  );
}
