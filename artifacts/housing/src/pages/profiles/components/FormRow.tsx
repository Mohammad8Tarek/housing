import { Label } from "@/components/ui/label";

const MAX_PROFILE_IMPORT_FILE_SIZE = 1024 * 1024;
const PROFILE_IMPORT_EXTENSIONS = [".xlsx", ".xls"];

/* ── Profile Photo Avatar ──────────────────────────────────────────────── */
export function FormRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
