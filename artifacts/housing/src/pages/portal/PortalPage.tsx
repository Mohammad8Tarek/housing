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

import { PortalContactsSection } from "./components/PortalContactsSection";
import { EvaluationsSection } from "./components/EvaluationsSection";
import { ActivitiesSection } from "./components/ActivitiesSection";
import { PortalAccountsSection } from "./components/PortalAccountsSection";
import { PortalDocsSection } from "./components/PortalDocsSection";
export function PortalPage() {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {ar ? "بوابة الموظفين" : "Employee Portal"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ar
            ? "إدارة التقييمات والفعاليات ومستندات البوابة وجهات الاتصال والتحليلات والجدولة"
            : "Manage evaluations, activities, portal documents, contacts, analytics, and scheduling"}
        </p>
      </div>
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="w-full md:w-auto flex gap-2 whitespace-nowrap mb-8 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
          <TabsTrigger
            value="analytics"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4" /> {ar ? "التحليلات" : "Analytics"}
          </TabsTrigger>
          <TabsTrigger
            value="accounts"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <Users className="w-4 h-4" /> {ar ? "الحسابات" : "Accounts"}
          </TabsTrigger>
          <TabsTrigger
            value="evaluations"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <Star className="w-4 h-4" /> {ar ? "التقييمات" : "Evaluations"}
          </TabsTrigger>
          <TabsTrigger
            value="activities"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <Trophy className="w-4 h-4" /> {ar ? "الفعاليات" : "Activities"}
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <Globe className="w-4 h-4" /> {ar ? "جهات الاتصال" : "Contacts"}
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <MessageSquare className="w-4 h-4" />{" "}
            {ar ? "المستندات" : "Documents"}
          </TabsTrigger>

          <TabsTrigger
            value="reports"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4" /> {ar ? "التقارير" : "Reports"}
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <Palette className="w-4 h-4" /> {ar ? "التصنيفات" : "Categories"}
          </TabsTrigger>
          <TabsTrigger
            value="food"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <UtensilsCrossed className="w-4 h-4" /> {ar ? "الطعام" : "Food"}
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4" /> {ar ? "المحادثات" : "Chat"}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="analytics"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <PortalAnalyticsDashboard />
        </TabsContent>

        <TabsContent
          value="accounts"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalAccountsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="evaluations"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <EvaluationsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="activities"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <ActivitiesSection />
        </TabsContent>

        <TabsContent
          value="contacts"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalContactsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="documents"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalDocsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="reports"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <PortalReports />
        </TabsContent>

        <TabsContent
          value="categories"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalCategoriesAndTags />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="food"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalFoodTransport />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="chat"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalChat />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
