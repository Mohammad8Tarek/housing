// State, effects and handlers of PoliciesSection (moved verbatim).
import { useState } from "react";
import * as XLSX from "xlsx";
import { useFormContext } from "react-hook-form";
import type { SettingsFormData, JobLevelPolicy } from "../../hooks/useSettingsForm";
import { DEFAULT_JOB_LEVEL_POLICIES } from "../../hooks/useSettingsForm";
import { printLuxuryReport } from "@/pages/reports/utils/luxury-report-engine";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import { useProperty } from "@/context/PropertyContext";
import { useGetSettings } from "@workspace/api-client-react";
import { toast } from "sonner";
import { SignatureStepItem, DEFAULT_SIGNATURE_POLICY, PoliciesSectionProps } from "./PoliciesSection.constants";

export function usePoliciesSectionState({
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
    propertyId: Number(currentPropId),
  } as any);

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
    isMandatory: boolean;
  }>({
    roleRequired: "housing_manager",
    labelAr: "",
    labelEn: "",
    description: "",
    isMandatory: true,
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
      isMandatory: true,
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
      isMandatory: item.isMandatory ?? true,
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
        isMandatory: stepForm.isMandatory ?? true,
      };
    } else {
      updated.push({
        id: `step_${Date.now()}`,
        stepOrder: updated.length + 1,
        roleRequired: trimmedRole,
        labelAr: trimmedAr,
        labelEn: trimmedEn,
        description: stepForm.description.trim(),
        isMandatory: stepForm.isMandatory ?? true,
      });
    }

    const normalized = updated.map((s, i) => ({
      ...s,
      stepOrder: i + 1,
      isMandatory: s.isMandatory ?? true,
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
    const normalized = updated.map((s, i) => ({ ...s, stepOrder: i + 1, isMandatory: s.isMandatory ?? true }));
    form.setValue("hostingRequestSignaturePolicy", normalized, { shouldDirty: true, shouldValidate: true });
  };

  const handleMoveStepDown = (idx: number) => {
    if (idx >= currentSignaturePolicy.length - 1) return;
    const updated = [...currentSignaturePolicy];
    const temp = updated[idx];
    updated[idx] = updated[idx + 1];
    updated[idx + 1] = temp;
    const normalized = updated.map((s, i) => ({ ...s, stepOrder: i + 1, isMandatory: s.isMandatory ?? true }));
    form.setValue("hostingRequestSignaturePolicy", normalized, { shouldDirty: true, shouldValidate: true });
  };

  const handleDeleteStep = (idx: number) => {
    if (currentSignaturePolicy.length <= 1) {
      toast.error(ar ? "يجب الإبقاء على خطوة اعتماد واحدة على الأقل" : "At least one signature step is required");
      return;
    }
    const updated = currentSignaturePolicy.filter((_, i) => i !== idx);
    const normalized = updated.map((s, i) => ({ ...s, stepOrder: i + 1, isMandatory: s.isMandatory ?? true }));
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

  const handleExportPolicyPdf = async () => {
    try {
      const values = form.getValues() || ({} as any);
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
                <div>• ${ar ? "الحد الأقصى للزيارة:" : "Max nights:"} <strong>${values.visitMaxNights ?? 30} ${ar ? "ليالٍ" : "nights"}</strong></div>
                <div>• ${ar ? "الحد الأقصى سنوياً:" : "Max visits/yr:"} <strong>${values.visitMaxVisitsPerYear ?? 2} ${ar ? "مرات" : "visits"}</strong></div>
                <div>• ${ar ? "الحد الأدنى للخدمة:" : "Min service:"} <strong>${values.visitMinServiceMonths ?? 6} ${ar ? "أشهر" : "months"}</strong></div>
                <div>• ${ar ? "فترة التهدئة بين الزيارات:" : "Cooldown:"} <strong>${values.visitCooldownDays ?? 60} ${ar ? "يوماً" : "days"}</strong></div>
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
                ${values.curfewEnabled ? `<strong style="color:#b91c1c; font-weight:800;">${ar ? `مفعل — يغلق تمام الساعة ${values.curfewTime || "23:00"}` : `Enabled at ${values.curfewTime || "23:00"}`}</strong>` : `<strong>${ar ? "مفتوح على مدار الساعة (24/7)" : "Open 24/7"}</strong>`}
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

      await printLuxuryReport({
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
    } catch (err: any) {
      console.error("Export Policy PDF error:", err);
      toast.error(ar ? "حدث خطأ أثناء فتح وثيقة السياسات" : "Failed to open policy document");
    }
  };
  return {
    propertyId,
    language,
    isLoading,
    propertyName,
    form,
    ar,
    properties,
    activeProperty,
    currentPropId,
    settingsData,
    existingJobTitles,
    isStepModalOpen,
    setIsStepModalOpen,
    editingStepIndex,
    setEditingStepIndex,
    stepForm,
    setStepForm,
    rawSignaturePolicy,
    currentSignaturePolicy,
    handleOpenAddStep,
    handleOpenEditStep,
    handleSaveStep,
    handleMoveStepUp,
    handleMoveStepDown,
    handleDeleteStep,
    handleResetWorkflow,
    isAddLevelOpen,
    setIsAddLevelOpen,
    newLevelKey,
    setNewLevelKey,
    newLevelNameEn,
    setNewLevelNameEn,
    newLevelNameAr,
    setNewLevelNameAr,
    newLevelCapacities,
    setNewLevelCapacities,
    newLevelAllowEntire,
    setNewLevelAllowEntire,
    newLevelDescription,
    setNewLevelDescription,
    handleToggleCapacity,
    handleToggleAllowEntire,
    handleDeleteLevel,
    handleAddLevel,
    handleResetDefaultLevels,
    isImportModalOpen,
    setIsImportModalOpen,
    importFileName,
    setImportFileName,
    importData,
    setImportData,
    handleExportExcelTemplate,
    handleFileChange,
    handleConfirmImport,
    handleExportPolicyPdf,
  };
}

export type PoliciesSectionState = ReturnType<typeof usePoliciesSectionState>;
