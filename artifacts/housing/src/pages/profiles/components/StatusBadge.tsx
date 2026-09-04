//@ts-nocheck
// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProfiles,
  useCreateProfile,
  useDeleteProfile,
  useUpdateProfile,
  getListProfilesQueryKey,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import {
  Eye,
  Trash2,
  Plus,
  Search,
  Users,
  AlertCircle,
  FileSpreadsheet,
  Pencil,
  Download,
  Upload,
  X,
  CheckCircle2,
  Camera,
  Key,
  ArrowRightLeft,
} from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import * as XLSX from "xlsx";
import { DataPagination } from "@/components/DataPagination";
import { PaginationBar } from "@/components/ui/PaginationBar";

const MAX_PROFILE_IMPORT_FILE_SIZE = 1024 * 1024;
const PROFILE_IMPORT_EXTENSIONS = [".xlsx", ".xls"];

export function StatusBadge({ status }: { status: string }) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const map: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    ACTIVE: {
      label: ar ? "مقيم بالسكن" : "In-House",
      className: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    },
    LEFT: {
      label: ar ? "مغادر" : "Check-out",
      className: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    },
    VACATION: {
      label: ar ? "في إجازة" : "Vacation",
      className: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    },
    UNASSIGNED: {
      label: ar ? "غير مسكّن" : "Unassigned",
      className: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    },
    SUSPENDED: {
      label: ar ? "موقوف" : "Suspended",
      className: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
    },
  };

  const cfg = map[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Badge variant="outline" className={`font-semibold text-xs px-2.5 py-0.5 border ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

/* ── Profile Add Dialog ─────────────────────────────────────────────────── */
