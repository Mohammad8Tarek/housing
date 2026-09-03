//@ts-nocheck
// @ts-nocheck
import { useState } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import PortalDocuments from "@/components/PortalDocuments";
import PortalAnalyticsDashboard from "@/components/PortalAnalyticsDashboard";

import PortalReports from "@/components/PortalReports";
import PortalCategoriesAndTags from "@/components/PortalCategoriesAndTags";
import PortalFoodTransport from "@/components/PortalFoodTransport";
import PortalChat from "@/components/PortalChat";
import {
  Star,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Trophy,
  MessageSquare,
  Globe,
  Mail,
  Phone,
  BarChart3,
  Bell,
  Users,
  Shield,
  RefreshCw,
  CheckCircle,
  XCircle,
  Palette,
  UtensilsCrossed,
  MessageCircle,
} from "lucide-react";

export function PortalDocsSection() {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          {ar ? "مستندات البوابة" : "Portal Documents"}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {ar
            ? "إدارة المستندات التي تظهر للموظفين في البوابة"
            : "Manage documents visible to profiles in the portal"}
        </p>
      </div>
      <PortalDocuments />
    </div>
  );
}
