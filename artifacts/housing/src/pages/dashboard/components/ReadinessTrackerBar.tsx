import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { CheckCircle2, BedDouble, Sparkles, Wrench, ShieldCheck } from "lucide-react";

interface ReadinessTrackerProps {
  totalRooms: number;
  available: number;
  occupied: number;
  dirty: number;
  maintenance: number;
  cleanRate?: number;
}

export function ReadinessTrackerBar({
  totalRooms = 0,
  available = 0,
  occupied = 0,
  dirty = 0,
  maintenance = 0,
  cleanRate,
}: ReadinessTrackerProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const total = Math.max(1, totalRooms);
  const pAvail = (available / total) * 100;
  const pOcc = (occupied / total) * 100;
  const pDirty = (dirty / total) * 100;
  const pMaint = (maintenance / total) * 100;

  const rate = cleanRate !== undefined ? cleanRate : Math.round(pAvail);

  return (
    <div className="p-4 rounded-2xl bg-card/75 backdrop-blur-xl border border-border/50 shadow-md space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-foreground">
              {ar ? "مؤشر جاهزية الغرف اللحظي" : "Live Room Readiness Tracker"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "متابعة فورية لحالة جميع الغرف في السكن"
                : "Real-time readiness and turnover status"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {ar ? "نسبة الجاهزية:" : "Readiness Rate:"}
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {rate}% {ar ? "جاهز للتسكين" : "Ready"}
          </span>
        </div>
      </div>

      {/* Multi-segment Tracker Progress Bar */}
      <div className="h-3 w-full rounded-full bg-muted/40 overflow-hidden flex shadow-inner">
        {available > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pAvail}%` }}
            transition={{ duration: 0.8 }}
            className="h-full bg-emerald-500 hover:brightness-110 transition-all cursor-pointer relative group"
            title={`${ar ? "جاهزة" : "Available"}: ${available}`}
          />
        )}
        {occupied > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pOcc}%` }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="h-full bg-indigo-500 hover:brightness-110 transition-all cursor-pointer"
            title={`${ar ? "مشغولة" : "Occupied"}: ${occupied}`}
          />
        )}
        {dirty > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pDirty}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="h-full bg-amber-500 hover:brightness-110 transition-all cursor-pointer"
            title={`${ar ? "بانتظار النظافة" : "Dirty"}: ${dirty}`}
          />
        )}
        {maintenance > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pMaint}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="h-full bg-rose-500 hover:brightness-110 transition-all cursor-pointer"
            title={`${ar ? "صيانة" : "Maintenance"}: ${maintenance}`}
          />
        )}
      </div>

      {/* Tracker Segment Pills */}
      <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span className="font-medium text-foreground">{available}</span>{" "}
          <span>{ar ? "جاهزة للتسكين" : "Ready"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
          <span className="font-medium text-foreground">{occupied}</span>{" "}
          <span>{ar ? "مشغولة" : "Occupied"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span className="font-medium text-foreground">{dirty}</span>{" "}
          <span>{ar ? "تحتاج نظافة" : "Need Cleaning"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
          <span className="font-medium text-foreground">{maintenance}</span>{" "}
          <span>{ar ? "تحت الصيانة" : "In Maintenance"}</span>
        </div>
      </div>
    </div>
  );
}
