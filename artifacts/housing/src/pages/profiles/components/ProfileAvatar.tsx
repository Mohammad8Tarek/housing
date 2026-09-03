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

/* ── Profile Photo Avatar ──────────────────────────────────────────────── */
export function ProfileAvatar({
  firstName,
  lastName,
  size = "sm",
  photoUrl,
}: {
  firstName: string;
  lastName: string;
  size?: "sm" | "md";
  photoUrl?: string | null;
}) {
  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const dim = size === "md" ? "w-12 h-12 text-base" : "w-8 h-8 text-xs";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        className={`${dim} rounded-full object-cover border flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0`}
    >
      <span className="font-bold text-primary">{initials}</span>
    </div>
  );
}

/* ── Photo Upload Button ────────────────────────────────────────────────── */
