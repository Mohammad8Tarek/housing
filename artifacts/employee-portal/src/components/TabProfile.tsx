import { useState, useEffect } from "react";
import { Camera, CheckCircle2, AlertCircle, Loader2, Save } from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { useLocation } from "wouter";
import { Preferences } from "@capacitor/preferences";
import MaterialIcon from "./MaterialIcon";

interface Props {
  photoUrl?: string;
}

const SAMPLE_DOCS = [
  { icon: "contract", label: "Employment Contract", key: "contract" },
  { icon: "gavel", label: "NDA Agreement", key: "nda" },
  {
    icon: "workspace_premium",
    label: "Training Certifications",
    key: "training",
  },
];

export default function TabProfile({ photoUrl }: Props) {
  const { t, lang } = useTheme();
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const [employee, setEmployee] = useState<any>(null);
  const [form, setForm] = useState({
    phone: "",
    address: "",
    photo: "",
    email: "",
    emergencyContact: "",
  });
  const [preview, setPreview] = useState(photoUrl || "");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);
    Promise.all([
      apiFetch("/api/portal-auth/me", { credentials: "include" }).then((r) =>
        r.json(),
      ),
      apiFetch("/api/portal-data/my-profile", { credentials: "include" }).then(
        (r) => r.json(),
      ),
    ])
      .then(([me, profile]) => {
        if (me.success && me.employee) setEmployee(me.employee);
        if (profile.success && profile.profile) {
          setForm((f) => ({
            ...f,
            phone: profile.profile.phone || "",
            address: profile.profile.address || "",
            email: profile.profile.email || "",
            emergencyContact: profile.profile.emergencyContact || "",
          }));
          setPreview(profile.profile.photoUrl || photoUrl || "");
        }
      })
      .catch(() => {});
  }, []);

  const saveProfileData = async (dataToSave: any) => {
    setStatus("loading");
    setMsg("");
    try {
      const res = await apiFetch("/api/portal-data/my-profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setStatus("success");
      setMsg(isRtl ? "تم الحفظ بنجاح" : "Saved successfully");
      setEditing(false);
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: any) {
      setStatus("error");
      setMsg(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfileData(form);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setStatus("error");
      setMsg(
        isRtl ? "يجب أن يكون الحجم أقل من 2MB" : "Image must be under 2MB",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target?.result as string;
      setPreview(url);
      setForm((f) => ({ ...f, photo: url }));
      // Auto-save when photo changes
      await saveProfileData({ ...form, photo: url });
    };
    reader.readAsDataURL(file);
  };

  const handleShare = async () => {
    const shareData = {
      title: employee?.fullName || "Employee",
      text: `${employee?.fullName || "Employee"} — ${employee?.jobTitle || ""} at Sunrise Resorts`,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      await navigator.clipboard?.writeText(shareData.text);
      setStatus("success");
      setMsg(isRtl ? "تم النسخ" : "Copied to clipboard");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  const handleDownloadDoc = async (doc: (typeof SAMPLE_DOCS)[0]) => {
    const blob = new Blob(["Sample document content placeholder"], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.key}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("portal_employee");
    Preferences.remove({ key: "portal_employee" });
    Preferences.remove({ key: "session_id" });
    setLocation("/login");
  };

  const initials = employee?.fullName
    ? employee.fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "EM";

  const infoSections = [
    {
      icon: "person",
      title: isRtl ? "البيانات الشخصية" : "Personal Details",
      rows: [
        {
          icon: "mail",
          label: isRtl ? "البريد الإلكتروني" : "Email Address",
          value: employee?.email || "—",
        },
        {
          icon: "call",
          label: isRtl ? "رقم الهاتف" : "Phone Number",
          value: form.phone || "—",
        },
        {
          icon: "emergency",
          label: isRtl ? "جهة الاتصال الطارئة" : "Emergency Contact",
          value: employee?.emergencyContact || (isRtl ? "غير محدد" : "Not set"),
        },
      ],
    },
    {
      icon: "work_history",
      title: isRtl ? "بيانات العمل" : "Employment Details",
      rows: [
        {
          icon: "business",
          label: isRtl ? "القسم" : "Department",
          value: employee?.department || (isRtl ? "عام" : "General"),
        },
        {
          icon: "verified",
          label: isRtl ? "الحالة" : "Status",
          value: null,
          badge: {
            label: isRtl ? "نشط" : "Active",
            color: "text-green-400 bg-green-400/10",
          },
        },
        {
          icon: "supervisor_account",
          label: isRtl ? "المدير المباشر" : "Manager",
          value: employee?.managerName || employee?.supervisor || "—",
        },
        {
          icon: "calendar_today",
          label: isRtl ? "تاريخ البدء" : "Start Date",
          value: employee?.hireDate
            ? new Date(employee.hireDate).toLocaleDateString()
            : employee?.startDate
              ? new Date(employee.startDate).toLocaleDateString()
              : "—",
        },
      ],
    },
  ];

  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      {/* Profile Card */}
      <div className="bg-card border border-border2 rounded-2xl overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#1A2B4C] to-[#2A3B5C] relative"></div>
        <div className="px-5 pb-5 -mt-12">
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[#C9A24D] to-[#E0C070] p-0.5 shadow-lg">
            <div className="w-full h-full rounded-[calc(1.5rem-2px)] bg-[#1A2B4C] flex items-center justify-center overflow-hidden">
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className="text-3xl font-bold text-white"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {initials}
                </span>
              )}
            </div>
            <label className="absolute -bottom-1 -end-1 w-7 h-7 rounded-full bg-accent2 text-accent2-foreground flex items-center justify-center cursor-pointer shadow-md hover:scale-105 transition-transform">
              <Camera className="w-3.5 h-3.5" />
              <input
                type="file"
                accept="image/*"
                onChange={handlePhoto}
                className="hidden"
              />
            </label>
          </div>
          <div className="mt-3">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {employee?.fullName || (isRtl ? "موظف" : "Employee")}
            </h2>
            <p className="text-[13px] text-accent2 font-semibold">
              {employee?.jobTitle || (isRtl ? "موظف" : "Employee")}
            </p>
            <p className="text-[11px] text-muted2">
              {employee?.department || ""}
            </p>
            <p className="text-[10px] text-muted2/60 mt-1">
              ID: {employee?.employeeId || "—"}
              {employee?.nationalId && (
                <span className="ms-3">CID: {employee.nationalId}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Share Digital Card */}
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent2/5 border border-accent2/20 text-accent2 text-[12px] font-bold hover:bg-accent2/10 transition-all active:scale-[0.98]"
        >
          <MaterialIcon icon="share" size={16} />
          {isRtl ? "مشاركة البطاقة الرقمية" : "Share Digital Card"}
        </button>
        <button
          onClick={() => setEditing(!editing)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface border border-border2 text-foreground text-[12px] font-bold hover:bg-card transition-all active:scale-[0.98]"
        >
          <MaterialIcon icon={editing ? "close" : "edit"} size={16} />
          {isRtl
            ? editing
              ? "إلغاء التعديل"
              : "تعديل البيانات"
            : editing
              ? "Cancel Editing"
              : "Edit Profile"}
        </button>
      </div>

      {/* Status Messages */}
      {status === "success" && (
        <div className="flex items-center gap-2 p-3 bg-green-400/10 border border-green-400/20 rounded-xl text-green-400 text-[12px]">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {msg}
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-[12px]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {msg}
        </div>
      )}

      {/* Info Sections */}
      {infoSections.map((section) => (
        <div key={section.title}>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <MaterialIcon
              icon={section.icon}
              size={18}
              className="text-accent2"
            />
            {section.title}
          </h3>
          <div className="bg-card border border-border2 rounded-xl divide-y divide-border2">
            {section.rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <MaterialIcon
                    icon={row.icon}
                    size={16}
                    className="text-muted2"
                  />
                  <span className="text-[12px] text-muted2">{row.label}</span>
                </div>
                {row.badge ? (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${row.badge.color}`}
                  >
                    <span className="w-1.5 h-1.5 bg-current rounded-full" />
                    {row.badge.label}
                  </span>
                ) : (
                  <span className="text-[12px] font-semibold text-foreground">
                    {row.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Key Documents */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <MaterialIcon icon="description" size={18} className="text-accent2" />
          {isRtl ? "المستندات الأساسية" : "Key Documents"}
          <button className="ms-auto text-[10px] font-bold text-accent2 hover:text-accent2/80 transition-colors flex items-center gap-1">
            {isRtl ? "عرض المستندات" : "View Vault"}
            <MaterialIcon
              icon={isRtl ? "chevron_left" : "chevron_right"}
              size={14}
            />
          </button>
        </h3>
        <div className="space-y-2">
          {SAMPLE_DOCS.map((doc) => (
            <button
              key={doc.key}
              onClick={() => handleDownloadDoc(doc)}
              className="w-full flex items-center justify-between p-3.5 bg-card border border-border2 rounded-xl hover:border-accent2/30 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface border border-border2 flex items-center justify-center">
                  <MaterialIcon
                    icon={doc.icon}
                    size={18}
                    className="text-accent2"
                  />
                </div>
                <span className="text-[12px] font-semibold text-foreground">
                  {doc.label}
                </span>
              </div>
              <MaterialIcon
                icon="download"
                size={16}
                className="text-muted2 hover:text-accent2 transition-colors"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border2 rounded-xl p-4 space-y-3"
        >
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MaterialIcon icon="edit" size={18} className="text-accent2" />
            {isRtl ? "تعديل البيانات" : "Edit Details"}
          </h3>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-1">
              {isRtl ? "الهاتف" : "Phone"}
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="w-full bg-surface border border-border2 text-foreground rounded-xl py-2.5 px-3 text-[13px] focus:outline-none focus:border-accent2/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-1">
              {isRtl ? "العنوان" : "Address"}
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
              className="w-full bg-surface border border-border2 text-foreground rounded-xl py-2.5 px-3 text-[13px] focus:outline-none focus:border-accent2/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-1">
              {isRtl ? "البريد الإلكتروني" : "Email"}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              className="w-full bg-surface border border-border2 text-foreground rounded-xl py-2.5 px-3 text-[13px] focus:outline-none focus:border-accent2/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-1">
              {isRtl ? "جهة الاتصال الطارئة" : "Emergency Contact"}
            </label>
            <input
              type="tel"
              value={form.emergencyContact}
              onChange={(e) =>
                setForm((f) => ({ ...f, emergencyContact: e.target.value }))
              }
              className="w-full bg-surface border border-border2 text-foreground rounded-xl py-2.5 px-3 text-[13px] focus:outline-none focus:border-accent2/50"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={status === "loading"}
              className="flex-1 py-2.5 rounded-xl bg-accent2 text-accent2-foreground text-[13px] font-bold hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isRtl ? "حفظ التغييرات" : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-[13px] font-bold hover:bg-red-400/20 transition-all flex items-center justify-center gap-2"
      >
        <MaterialIcon icon="logout" size={18} />
        {isRtl ? "تسجيل الخروج" : "Log Out"}
      </button>
    </div>
  );
}
