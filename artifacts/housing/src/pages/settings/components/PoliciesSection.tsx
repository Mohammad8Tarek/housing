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
} from "lucide-react";
import * as XLSX from "xlsx";
import { useFormContext } from "react-hook-form";
import type { SettingsFormData } from "../hooks/useSettingsForm";
import { printLuxuryReport } from "@/pages/reports/utils/luxury-report-engine";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import { toast } from "sonner";

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

  // Fetch job titles to map against custom rules
  const { data: existingJobTitles = [] } = useLookupValues(
    propertyId,
    LOOKUP_CATEGORIES.JOB_TITLE,
    true
  );

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<{
    name: string;
    nameAr: string;
    capacity: number;
    allowEntire: boolean;
    description: string;
  }>({
    name: "",
    nameAr: "",
    capacity: 5,
    allowEntire: false,
    description: "",
  });

  const customRules: any[] = form.watch("customLevelRules") || [];

  const handleOpenAddRule = (presetName?: string, presetCap?: number) => {
    setEditingRuleId(null);
    setRuleForm({
      name: presetName || "",
      nameAr: presetName ? (presetName === "Level 5" ? "المستوى 5 (سكن عمال 5 أفراد)" : presetName === "Level 6" ? "المستوى 6 (سكن جماعي 6 أفراد)" : "") : "",
      capacity: presetCap || 5,
      allowEntire: false,
      description: "",
    });
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule: any) => {
    setEditingRuleId(rule.id);
    setRuleForm({
      name: rule.name || "",
      nameAr: rule.nameAr || "",
      capacity: Number(rule.capacity) || 5,
      allowEntire: Boolean(rule.allowEntire),
      description: rule.description || "",
    });
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = () => {
    const trimmedName = ruleForm.name.trim();
    if (!trimmedName) {
      toast.error(ar ? "يرجى كتابة اسم أو كود الدرجة (مثل Level 5)" : "Rule code/name is required");
      return;
    }
    const currentList = [...(form.getValues("customLevelRules") || [])];

    if (editingRuleId) {
      const idx = currentList.findIndex((r: any) => r.id === editingRuleId);
      if (idx !== -1) {
        currentList[idx] = {
          ...currentList[idx],
          name: trimmedName,
          nameAr: ruleForm.nameAr.trim(),
          capacity: Number(ruleForm.capacity) || 5,
          allowEntire: ruleForm.allowEntire,
          description: ruleForm.description.trim(),
        };
      }
    } else {
      currentList.push({
        id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: trimmedName,
        nameAr: ruleForm.nameAr.trim(),
        capacity: Number(ruleForm.capacity) || 5,
        allowEntire: ruleForm.allowEntire,
        description: ruleForm.description.trim(),
      });
    }

    form.setValue("customLevelRules", currentList, { shouldDirty: true, shouldValidate: true });
    setIsRuleModalOpen(false);
    toast.success(
      editingRuleId
        ? (ar ? "تم تعديل قاعدة الاستحقاق بنجاح" : "Entitlement rule updated")
        : (ar ? "تمت إضافة قاعدة الاستحقاق بنجاح" : "New entitlement rule created")
    );
  };

  const handleDeleteRule = (ruleId: string) => {
    const currentList = [...(form.getValues("customLevelRules") || [])];
    const updated = currentList.filter((r: any) => r.id !== ruleId);
    form.setValue("customLevelRules", updated, { shouldDirty: true, shouldValidate: true });
    toast.success(ar ? "تم حذف قاعدة الاستحقاق" : "Rule deleted");
  };

  const getLinkedTitlesForRule = (ruleName: string, ruleNameAr?: string) => {
    const qName = ruleName.trim().toLowerCase();
    const qNameAr = (ruleNameAr || "").trim().toLowerCase();
    return existingJobTitles.filter((jt: any) => {
      const extra = String(jt.extraValue || "").trim().toLowerCase();
      return (
        extra === qName ||
        (qNameAr && extra === qNameAr) ||
        (qName && extra.includes(qName))
      );
    });
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

    // 1. Level Capacities Sheet
    const levelCapacities = [
      {
        "Level Key": "policyLevel0Capacity",
        "Level Name (Ar)": "الدرجة صفر (إدارة عليا / VIP)",
        "Level Name (En)": "Level 0 (Top Executive / VIP)",
        "Max Capacity (Beds)": Number(values.policyLevel0Capacity) || 1,
        "Allow Entire Room": values.policyLevel0AllowEntire ? "YES" : "NO",
        "Notes": "غرفة فردية أو جناح مستقل للقيادات",
      },
      {
        "Level Key": "policyLevel1Capacity",
        "Level Name (Ar)": "الدرجة الأولى (مدراء العموم)",
        "Level Name (En)": "Level 1 (Department Heads / GMs)",
        "Max Capacity (Beds)": Number(values.policyLevel1Capacity) || 1,
        "Allow Entire Room": values.policyLevel1AllowEntire ? "YES" : "NO",
        "Notes": "غرفة فردية مستقلة لمدراء الإدارات",
      },
      {
        "Level Key": "policyLevel2Capacity",
        "Level Name (Ar)": "الدرجة الثانية (المشرفون)",
        "Level Name (En)": "Level 2 (Supervisory / Assistants)",
        "Max Capacity (Beds)": Number(values.policyLevel2Capacity) || 2,
        "Allow Entire Room": values.policyLevel2AllowEntire ? "YES" : "NO",
        "Notes": "سكن إشرافي ثنائي أو استثنائي",
      },
      {
        "Level Key": "policyLevel3Capacity",
        "Level Name (Ar)": "الدرجة الثالثة (الموظفون والفنيون)",
        "Level Name (En)": "Level 3 (Staff / Technicians)",
        "Max Capacity (Beds)": Number(values.policyLevel3Capacity) || 3,
        "Allow Entire Room": "NO",
        "Notes": "سكن ثلاثي مشترك للموظفين",
      },
      {
        "Level Key": "policyLevel4Capacity",
        "Level Name (Ar)": "الدرجة الرابعة (العمال والخدمات)",
        "Level Name (En)": "Level 4 (Workers / Line Staff)",
        "Max Capacity (Beds)": Number(values.policyLevel4Capacity) || 4,
        "Allow Entire Room": "NO",
        "Notes": "سكن رباعي مشترك للعمال",
      },
      {
        "Level Key": "policyLevel5Capacity",
        "Level Name (Ar)": "الدرجة الخامسة (سكن خماسي)",
        "Level Name (En)": "Level 5 (5-Bed Shared)",
        "Max Capacity (Beds)": Number(values.policyLevel5Capacity) || 5,
        "Allow Entire Room": values.policyLevel5AllowEntire ? "YES" : "NO",
        "Notes": "سكن خماسي مشترك",
      },
      {
        "Level Key": "policyLevel6Capacity",
        "Level Name (Ar)": "الدرجة السادسة (سكن سداسي)",
        "Level Name (En)": "Level 6 (6-Bed Shared)",
        "Max Capacity (Beds)": Number(values.policyLevel6Capacity) || 6,
        "Allow Entire Room": values.policyLevel6AllowEntire ? "YES" : "NO",
        "Notes": "سكن مكثف سداسي مشترك",
      },
    ];

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

    // 1. Apply Level Capacities
    for (const row of importData.levelCapacities) {
      const key = row["Level Key"] || row["key"] || row["Key"];
      const cap = Number(row["Max Capacity (Beds)"] || row["capacity"] || row["Capacity"]);
      const allowEnt = String(row["Allow Entire Room"] || "").toUpperCase().trim();
      const isEntire =
        allowEnt === "YES" || allowEnt === "TRUE" || allowEnt === "نعم" || allowEnt === "1";

      if (key && !isNaN(cap) && cap > 0) {
        form.setValue(key as any, cap, { shouldDirty: true, shouldValidate: true });
        appliedCount++;
      }

      if (key === "policyLevel0Capacity") {
        form.setValue("policyLevel0AllowEntire", isEntire, { shouldDirty: true });
      } else if (key === "policyLevel1Capacity") {
        form.setValue("policyLevel1AllowEntire", isEntire, { shouldDirty: true });
      } else if (key === "policyLevel2Capacity") {
        form.setValue("policyLevel2AllowEntire", isEntire, { shouldDirty: true });
      } else if (key === "policyLevel5Capacity") {
        form.setValue("policyLevel5AllowEntire", isEntire, { shouldDirty: true });
      } else if (key === "policyLevel6Capacity") {
        form.setValue("policyLevel6AllowEntire", isEntire, { shouldDirty: true });
      }
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
    const propName = propertyName || (ar ? "سكن موظفي صن رايز" : "Sunrise Staff Housing");

    const policyContentHtml = `
      <div style="font-family: inherit; line-height: 1.8; color: #1e293b; padding: 10px 0;">
        <div style="background: linear-gradient(135deg, #0F2A44 0%, #1e3a5f 100%); color: #fff; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 8px 0; color: #C9A24D; font-size: 20px; font-weight: bold;">
            ${ar ? "وثيقة ولائحة سياسات السكن الرسمية" : "Official Housing Policy & Code of Conduct"}
          </h2>
          <p style="margin: 0; font-size: 13px; opacity: 0.9;">
            ${propName} — ${ar ? "تطبق على كافة النزلاء والمقيمين بالسكن" : "Applicable to all housing residents"}
          </p>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #0F2A44; border-bottom: 2px solid #C9A24D; padding-bottom: 6px; font-size: 16px;">
            ${ar ? "1. استحقاق السكن وتوزيع الغرف حسب الدرجة الوظيفية" : "1. Room Allocation & Job Level Entitlements"}
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #0F2A44; border: 1px solid #cbd5e1;">
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: start;">${ar ? "الدرجة الوظيفية" : "Job Level"}</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: start;">${ar ? "الحد الأقصى للأفراد بالغرفة" : "Max Room Capacity"}</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: start;">${ar ? "إمكانية حجز غرفة كاملة (Single)" : "Entire Room Allowance"}</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background-color: #fffbeb;">
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong style="color: #b45309;">${ar ? "الدرجة صفر (Level 0 - الإدارة العليا / VIP)" : "Level 0 (Executive / VIP)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel0Capacity} ${ar ? "فرد (غرفة مستقلة / جناح)" : "person (Single / Suite)"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel0AllowEntire ? (ar ? "مسموح (غرفة كاملة مستقلة)" : "Allowed (Entire Room)") : (ar ? "غير مسموح" : "Not Allowed")}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${ar ? "الدرجة الأولى (Level 1 - المدراء)" : "Level 1 (Executive/Managers)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel1Capacity} ${ar ? "فرد" : "person"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel1AllowEntire ? (ar ? "مسموح (غرفة فردية كاملة)" : "Allowed (Entire Room)") : (ar ? "غير مسموح" : "Not Allowed")}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${ar ? "الدرجة الثانية (Level 2 - المشرفين)" : "Level 2 (Supervisors)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel2Capacity} ${ar ? "أفراد" : "persons"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel2AllowEntire ? (ar ? "مسموح" : "Allowed") : (ar ? "تسكين مشترك فقط" : "Shared Only")}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${ar ? "الدرجة الثالثة (Level 3 - الموظفين)" : "Level 3 (Staff)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel3Capacity} ${ar ? "أفراد" : "persons"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${ar ? "تسكين مشترك" : "Shared Only"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${ar ? "الدرجة الرابعة (Level 4 - العمال)" : "Level 4 (Workers)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel4Capacity} ${ar ? "أفراد" : "persons"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${ar ? "تسكين مشترك" : "Shared Only"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${ar ? "الدرجة الخامسة (Level 5 - سعة 5 أفراد)" : "Level 5 (5-Bed Shared)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel5Capacity || 5} ${ar ? "أفراد" : "persons"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel5AllowEntire ? (ar ? "مسموح" : "Allowed") : (ar ? "تسكين مشترك" : "Shared Only")}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${ar ? "الدرجة السادسة (Level 6 - سعة 6 أفراد)" : "Level 6 (6-Bed Shared)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel6Capacity || 6} ${ar ? "أفراد" : "persons"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel6AllowEntire ? (ar ? "مسموح" : "Allowed") : (ar ? "تسكين مشترك" : "Shared Only")}</td>
              </tr>
              ${(values.customLevelRules || []).map((rule: any) => `
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${rule.nameAr || rule.name}</strong> <span style="font-size:10px; color:#64748b;">(${rule.name})</span></td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;">${rule.capacity} ${ar ? "أفراد" : "persons"}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;">${rule.allowEntire ? (ar ? "مسموح (غرفة كاملة)" : "Allowed (Entire Room)") : (ar ? "تسكين مشترك" : "Shared Only")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <p style="margin-top: 8px; font-size: 12px; color: #475569;">
            * ${ar ? "سياسة توحيد الأقسام بالغرف (Department Clustering): " : "Department Clustering Policy: "}
            <strong>${values.policyDepartmentClustering ? (ar ? "مفعلة (يقوم النظام تلقائياً باختيار غرف من نفس القسم)" : "Enabled (Auto-match roommates from same department)") : (ar ? "معطلة" : "Disabled")}</strong>
            ${values.policyStrictDepartmentSegregation ? `<br />* <span style="color:#b91c1c; font-weight:bold;">${ar ? "تنبيه صارم: يُمنع نهائياً تسكين أقسام مختلفة في نفس الغرفة." : "Strict segregation: Different departments in the same room are strictly prohibited."}</span>` : ""}
          </p>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #0F2A44; border-bottom: 2px solid #C9A24D; padding-bottom: 6px; font-size: 16px;">
            ${ar ? "2. سياسة وضوابط الزيارات العائلية" : "2. Family Visit Policy & Rules"}
          </h3>
          <ul style="font-size: 12px; color: #334155; margin: 8px 0; padding-${ar ? "right" : "left"}: 20px;">
            <li><strong>${ar ? "الحد الأقصى لليالي الزيارة الواحدة:" : "Max nights per visit:"}</strong> ${values.visitMaxNights} ${ar ? "ليالي" : "nights"}</li>
            <li><strong>${ar ? "الحد الأقصى لعدد الزيارات المسموح بها سنوياً:" : "Max visits per year:"}</strong> ${values.visitMaxVisitsPerYear} ${ar ? "زيارات" : "visits"}</li>
            <li><strong>${ar ? "الحد الأدنى لخدمة الموظف قبل استحقاق الزيارة:" : "Min service before eligibility:"}</strong> ${values.visitMinServiceMonths} ${ar ? "أشهر" : "months"}</li>
            <li><strong>${ar ? "فترة التهدئة الفاصلة بين زيارة وأخرى:" : "Cooldown period between visits:"}</strong> ${values.visitCooldownDays} ${ar ? "يوماً" : "days"}</li>
            <li><strong>${ar ? "إلزامية الرقم القومي / إثبات الهوية لكافة المرافقين:" : "Mandatory National ID for companions:"}</strong> ${values.visitRequireNationalId ? (ar ? "إلزامي لكافة الأفراد والمرافقين" : "Mandatory for all companions") : (ar ? "اختياري" : "Optional")}</li>
          </ul>
          ${values.familyVisitPolicyText ? `<div style="background:#f8fafc; padding:12px; border-left:4px solid #C9A24D; font-size:12px; white-space:pre-wrap; margin-top:8px;">${values.familyVisitPolicyText}</div>` : ""}
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #0F2A44; border-bottom: 2px solid #C9A24D; padding-bottom: 6px; font-size: 16px;">
            ${ar ? "3. لائحة السكن ومواعيد الإغلاق (Curfew & Housing Rules)" : "3. Housing Rules & Curfew"}
          </h3>
          <p style="font-size: 12px; color: #334155; margin: 6px 0;">
            <strong>${ar ? "موعد إغلاق بوابات السكن (Curfew):" : "Curfew Policy:"}</strong>
            ${values.curfewEnabled ? `<span style="color:#b91c1c; font-weight:bold;">${ar ? `مفعل — الساعة ${values.curfewTime}` : `Enabled at ${values.curfewTime}`}</span>` : (ar ? "غير محدد / حر" : "Open / No Curfew")}
          </p>
          ${values.housingRulesText ? `<div style="background:#f8fafc; padding:12px; border-left:4px solid #0F2A44; font-size:12px; white-space:pre-wrap; margin-top:8px;">${values.housingRulesText}</div>` : ""}
          ${values.housingPolicyText ? `<div style="background:#fffbeb; padding:12px; border-left:4px solid #f59e0b; font-size:12px; white-space:pre-wrap; margin-top:8px;">${values.housingPolicyText}</div>` : ""}
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #0F2A44; border-bottom: 2px solid #C9A24D; padding-bottom: 6px; font-size: 16px;">
            ${ar ? "4. سياسة فصل الجنسين وسكن العائلات الصارمة" : "4. Strict Gender & Family Segregation"}
          </h3>
          <ul style="font-size: 12px; color: #334155; margin: 8px 0; padding-${ar ? "right" : "left"}: 20px;">
            <li><strong>${ar ? "فصل الجنسين الصارم:" : "Strict Gender Segregation:"}</strong> ${values.policyStrictGenderSegregation ? `<span style="color:#16a34a; font-weight:bold;">${ar ? "مفعل وصارم (يُمنع منعاً باتاً خلط الذكور والإناث بالغرفة المشتركة أو الأجنحة المخصصة)" : "Active & Enforced (Strictly prohibits mixed gender shared housing)"}</span>` : (ar ? "تنبيهي فقط" : "Advisory")}</li>
            <li><strong>${ar ? "سكن العائلات المستقل:" : "Family Accommodation Segregation:"}</strong> ${values.policyStrictFamilySegregation ? `<span style="color:#16a34a; font-weight:bold;">${ar ? "مفعل وصارم (حظر تسكين العزاب في أجنحة العائلات)" : "Active & Enforced (Bachelors barred from family suites)"}</span>` : (ar ? "تنبيهي فقط" : "Advisory")}</li>
          </ul>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #0F2A44; border-bottom: 2px solid #C9A24D; padding-bottom: 6px; font-size: 16px;">
            ${ar ? "5. الحوكمة واعتماد الاستثناءات الإدارية والتعلم الذكي" : "5. Governance, Exception Approvals & AI Learning"}
          </h3>
          <ul style="font-size: 12px; color: #334155; margin: 8px 0; padding-${ar ? "right" : "left"}: 20px;">
            <li><strong>${ar ? "حوكمة واعتماد استثناءات التسكين:" : "Exception Approval Governance:"}</strong> ${values.policyRequireExceptionApproval ? `<span style="color:#0284c7; font-weight:bold;">${ar ? "إلزامي (يتطلب تسجيل سبب إداري ومسؤول معتمد رسمياً لأي مخالفة)" : "Mandatory (Requires formal approval and reason logged)"}</span>` : (ar ? "اختياري" : "Optional")}</li>
            <li><strong>${ar ? "الذكاء الاصطناعي والتعلم السلوكي للأقسام:" : "AI Adaptive Department Learning:"}</strong> ${values.policyAdaptiveLearning ? `<span style="color:#0284c7; font-weight:bold;">${ar ? "مفعل (يتعلم النظام سلوكياً توزيع الأقسام والمناطق المفضلة)" : "Active (System learns departmental territorial sectors)"}</span>` : (ar ? "معطل" : "Disabled")}</li>
          </ul>
        </div>

        <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 16px;">
          <h4 style="color: #0F2A44; font-size: 14px; margin-bottom: 12px;">${ar ? "مسؤولو التواصل والإبلاغ عن المخالفات والطوارئ" : "Emergency & Key Contact Persons"}</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 11px;">
            ${values.hrContact1Name ? `<div style="background:#f1f5f9; padding:8px; border-radius:4px;"><strong>${values.hrContact1Title || (ar ? "مدير الموارد البشرية" : "HR Manager")}:</strong> ${values.hrContact1Name} | ${values.hrContact1Phone} | ${values.hrContact1Email}</div>` : ""}
            ${values.hrContact2Name ? `<div style="background:#f1f5f9; padding:8px; border-radius:4px;"><strong>${values.hrContact2Title || (ar ? "منسق الموارد البشرية" : "HR Coordinator")}:</strong> ${values.hrContact2Name} | ${values.hrContact2Phone} | ${values.hrContact2Email}</div>` : ""}
            ${values.housingManager1Name ? `<div style="background:#f1f5f9; padding:8px; border-radius:4px;"><strong>${values.housingManager1Title || (ar ? "مدير السكن" : "Housing Manager")}:</strong> ${values.housingManager1Name} | ${values.housingManager1Phone} | ${values.housingManager1Email}</div>` : ""}
            ${values.housingManager2Name ? `<div style="background:#f1f5f9; padding:8px; border-radius:4px;"><strong>${values.housingManager2Title || (ar ? "مساعد مدير السكن" : "Assistant Housing Manager")}:</strong> ${values.housingManager2Name} | ${values.housingManager2Phone} | ${values.housingManager2Email}</div>` : ""}
          </div>
        </div>
      </div>
    `;

    printLuxuryReport({
      title: ar ? "لائحة وسياسات السكن الرسمية" : "Official Housing Policy & Code of Conduct",
      titleAr: "لائحة وسياسات السكن الرسمية",
      subtitle: propName,
      subtitleAr: propName,
      language: ar ? "ar" : "en",
      orientation: "portrait",
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="w-4 h-4 text-primary" />
                {ar ? "1. سياسة استحقاق السكن والدرجات الوظيفية (Allocation Rules)" : "1. Job Level Entitlements & Department Rules"}
              </CardTitle>
          <CardDescription>
            {ar
              ? "تحديد سعة الغرف المسموحة لكل درجة وظيفية وضوابط تسكين الأقسام المشتركة"
              : "Set room capacity per job level and configure department clustering rules"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            <FormField
              control={form.control}
              name="policyLevel0Capacity"
              render={({ field }) => (
                <FormItem className="bg-amber-500/10 p-3 rounded-lg border border-amber-300/70 dark:border-amber-700/50">
                  <FormLabel className="text-xs font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                    <Badge variant="outline" className="bg-amber-500 text-white border-amber-600 text-[10px] font-bold">Level 0 ★</Badge>
                    {ar ? "سعة الإدارة العليا" : "Level 0 Capacity"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={5} {...field} className="bg-background" />
                  </FormControl>
                  <FormDescription className="text-[11px] text-amber-900/80 dark:text-amber-300/80 font-medium">
                    {ar ? "القيادات العليا والمدراء العموم / VIP (1 فرد)" : "Top Execs / GM / VIP (default 1)"}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyLevel1Capacity"
              render={({ field }) => (
                <FormItem className="bg-muted/30 p-3.5 rounded-lg border">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300 text-[10px]">Level 1</Badge>
                    {ar ? "الدرجة الأولى" : "Level 1"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "مدراء العموم والقطاعات (1 فرد)" : "Executive / GMs (default 1)"}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyLevel2Capacity"
              render={({ field }) => (
                <FormItem className="bg-muted/30 p-3.5 rounded-lg border">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-300 text-[10px]">Level 2</Badge>
                    {ar ? "الدرجة الثانية" : "Level 2"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "مدراء الأقسام (عادة 2)" : "Department Heads (default 2)"}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyLevel3Capacity"
              render={({ field }) => (
                <FormItem className="bg-muted/30 p-3.5 rounded-lg border">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 border-indigo-300 text-[10px]">Level 3</Badge>
                    {ar ? "الدرجة الثالثة" : "Level 3"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "المشرفون (عادة 3)" : "Supervisors/Staff (default 3)"}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyLevel4Capacity"
              render={({ field }) => (
                <FormItem className="bg-muted/30 p-3.5 rounded-lg border">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[10px]">Level 4</Badge>
                    {ar ? "الدرجة الرابعة" : "Level 4"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "العمال والخدمات (عادة 4)" : "Workers (default 4)"}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyLevel5Capacity"
              render={({ field }) => (
                <FormItem className="bg-muted/30 p-3.5 rounded-lg border">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-300 text-[10px]">Level 5</Badge>
                    {ar ? "الدرجة الخامسة" : "Level 5"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={15} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "غرف خماسية (عادة 5)" : "5-Bed rooms (default 5)"}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyLevel6Capacity"
              render={({ field }) => (
                <FormItem className="bg-muted/30 p-3.5 rounded-lg border">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 border-cyan-300 text-[10px]">Level 6</Badge>
                    {ar ? "الدرجة السادسة" : "Level 6"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={15} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "غرف سداسية (عادة 6)" : "6-Bed rooms (default 6)"}
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Entire Room Booking & Department Clustering */}
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
              name="policyLevel0AllowEntire"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-amber-500/5 border-amber-300/60 dark:border-amber-700/50">
                  <div className="space-y-0.5 pe-4">
                    <FormLabel className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      {ar ? "حجز غرفة كاملة للإدارة العليا (Level 0 Entire Room)" : "Allow Entire Room for Level 0"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar
                        ? "استحقاق حجز الغرفة بالكامل كفردي أو جناح مستقل لقيادات الإدارة العليا"
                        : "Allow booking full single room/suite for Level 0 executives"}
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
              name="policyLevel1AllowEntire"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                  <div className="space-y-0.5 pe-4">
                    <FormLabel className="text-xs font-bold">
                      {ar ? "السماح بحجز غرفة كاملة (Level 1 Entire Room)" : "Allow Entire Room for Level 1"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar
                        ? "استحقاق حجز الغرفة بالكامل كفردي لمدراء الدرجة الأولى"
                        : "Allow booking the entire room for Level 1 executives"}
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
              name="policyLevel2AllowEntire"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                  <div className="space-y-0.5 pe-4">
                    <FormLabel className="text-xs font-bold">
                      {ar ? "السماح بحجز غرفة كاملة (Level 2 Entire Room)" : "Allow Entire Room for Level 2"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar
                        ? "إتاحة حجز الغرفة كاملة لمدراء الدرجة الثانية في حالات الاستثناء"
                        : "Allow booking the entire room for Level 2 department managers"}
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
              name="policyLevel5AllowEntire"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                  <div className="space-y-0.5 pe-4">
                    <FormLabel className="text-xs font-bold">
                      {ar ? "السماح بحجز غرفة كاملة (Level 5 Entire Room)" : "Allow Entire Room for Level 5"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar
                        ? "إتاحة حجز الغرفة بالكامل لموظفي الدرجة الخامسة في حالات الاستثناء"
                        : "Allow booking entire room for Level 5 staff"}
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
              name="policyLevel6AllowEntire"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                  <div className="space-y-0.5 pe-4">
                    <FormLabel className="text-xs font-bold">
                      {ar ? "السماح بحجز غرفة كاملة (Level 6 Entire Room)" : "Allow Entire Room for Level 6"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar
                        ? "إتاحة حجز الغرفة بالكامل لموظفي الدرجة السادسة في حالات الاستثناء"
                        : "Allow booking entire room for Level 6 staff"}
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

      {/* Custom Job Level Rules Card */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-primary" />
              {ar
                ? "قواعد ومستويات الاستحقاق المخصصة (Custom Job Level Rules)"
                : "Custom Job Level Rules & Capacity"}
            </CardTitle>
            <CardDescription>
              {ar
                ? "يمكنك إنشاء مستويات وقواعد استحقاق جديدة بحسب مسميات الوظائف (مثلاً: درجات لغرف 5 أفراد، 6 أفراد، أو فرق عمل خاصة)"
                : "Create custom entitlement rules and capacity levels linked to job titles (e.g. 5 or 6-bed rooms, team leads)"}
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenAddRule()}
            className="gap-1.5 text-xs font-semibold self-start sm:self-auto bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            {ar ? "إضافة مستوى / قاعدة جديدة" : "Add Custom Rule"}
          </Button>
        </CardHeader>
        <CardContent>
          {(!form.watch("customLevelRules") || form.watch("customLevelRules").length === 0) ? (
            <div className="text-center py-8 border border-dashed rounded-lg bg-muted/20 text-muted-foreground">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-50 text-primary" />
              <p className="text-sm font-medium">
                {ar ? "لا توجد قواعد مستويات مخصصة مضافة حالياً" : "No custom level rules created yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {ar
                  ? "المستويات الأساسية (Level 0 حتى Level 6) تعمل تلقائياً. يمكنك إضافة قواعد إضافية هنا لربطها بالمسميات الوظيفية."
                  : "Standard levels (Level 0 through Level 6) work automatically. Add extra custom rules here to link with job titles."}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold text-xs">{ar ? "كود / اسم المستوى" : "Level Code / Name"}</TableHead>
                    <TableHead className="font-bold text-xs">{ar ? "الاسم العربي" : "Arabic Label"}</TableHead>
                    <TableHead className="font-bold text-xs text-center">{ar ? "السعة القصوى للغرفة" : "Max Room Capacity"}</TableHead>
                    <TableHead className="font-bold text-xs text-center">{ar ? "حجز غرفة كاملة" : "Entire Room"}</TableHead>
                    <TableHead className="font-bold text-xs text-center">{ar ? "الوظائف المرتبطة" : "Linked Job Titles"}</TableHead>
                    <TableHead className="font-bold text-xs">{ar ? "الوصف" : "Description"}</TableHead>
                    <TableHead className="font-bold text-xs text-end w-24">{ar ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.watch("customLevelRules").map((rule: any) => {
                    const linked = getLinkedTitlesForRule(rule.name, rule.nameAr);
                    return (
                      <TableRow key={rule.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-semibold text-xs text-primary">
                          <Badge variant="outline" className="font-mono bg-primary/5 text-primary border-primary/30">
                            {rule.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{rule.nameAr || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-bold text-xs">
                            {rule.capacity} {ar ? "أفراد" : "beds"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {rule.allowEntire ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[10px]">
                              {ar ? "مسموح" : "Allowed"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px]">
                              {ar ? "مشترك" : "Shared"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className="text-[11px]"
                            title={linked.map((j: any) => j.value).join(", ")}
                          >
                            {linked.length} {ar ? "وظيفة" : "titles"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={rule.description}>
                          {rule.description || "—"}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => handleOpenEditRule(rule)}
                              title={ar ? "تعديل" : "Edit"}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => handleDeleteRule(rule.id)}
                              title={ar ? "حذف" : "Delete"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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

    {/* Custom Level Rule Dialog Modal */}
    <Dialog open={isRuleModalOpen} onOpenChange={setIsRuleModalOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            {editingRuleId
              ? (ar ? "تعديل قاعدة استحقاق الغرف والدرجة" : "Edit Entitlement Rule")
              : (ar ? "إضافة قاعدة استحقاق ودرجة وظيفية جديدة" : "Add New Job Level Entitlement Rule")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? "حدد كود المستوى وسعة استيعاب الغرف لربطه مع المسميات الوظيفية واقتراحات التسكين الذكي"
              : "Specify level code, room capacity, and privileges to link with job titles and recommender"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                {ar ? "كود / اسم المستوى" : "Level Code / Identifier"} <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder={ar ? "مثال: Level 5 أو Level 6" : "e.g. Level 5, Level 6"}
                value={ruleForm.name}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
                className="h-9 text-xs font-semibold"
              />
              <p className="text-[10px] text-muted-foreground">
                {ar ? "يُكتب في خانة 'الدرجة' بالمسمى الوظيفي" : "Enter this in Job Title 'Level'"}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">{ar ? "الاسم العربي" : "Arabic Label"}</label>
              <Input
                placeholder={ar ? "مثال: الدرجة 5 (سكن 5 أفراد)" : "e.g. Grade 5"}
                value={ruleForm.nameAr}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, nameAr: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                {ar ? "الحد الأقصى لسعة الغرفة" : "Max Room Capacity"} <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min={1}
                max={20}
                value={ruleForm.capacity}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, capacity: Number(e.target.value) || 1 }))}
                className="h-9 text-xs font-bold text-center"
              />
              <p className="text-[10px] text-muted-foreground">
                {ar ? "عدد الأفراد المسموح بهم بالغرفة" : "Allowed persons per room"}
              </p>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 mt-3">
              <div className="space-y-0.5 pe-2">
                <label className="text-xs font-semibold block">{ar ? "حجز غرفة كاملة" : "Allow Entire Room"}</label>
                <span className="text-[10px] text-muted-foreground">{ar ? "استحقاق فردي مستقل" : "Single occupancy"}</span>
              </div>
              <Switch
                checked={ruleForm.allowEntire}
                onCheckedChange={(checked) => setRuleForm((prev) => ({ ...prev, allowEntire: checked }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">{ar ? "الوصف / ملاحظات الاستحقاق" : "Description / Notes"}</label>
            <Textarea
              placeholder={ar ? "أية تفاصيل إضافية عن سياسة استحقاق هذه الفئة..." : "Additional details on room entitlement..."}
              value={ruleForm.description}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsRuleModalOpen(false)}
            className="text-xs"
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveRule}
            className="text-xs font-semibold gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {ar ? "حفظ القاعدة" : "Save Rule"}
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
  </div>
  );
}
