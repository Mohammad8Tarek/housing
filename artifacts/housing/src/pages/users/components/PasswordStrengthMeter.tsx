import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordRule {
  key: string;
  labelEn: string;
  labelAr: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0 (empty), 1 (weak), 2 (fair), 3 (good), 4 (strong)
  labelEn: string;
  labelAr: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  rules: PasswordRule[];
  isValid: boolean;
}

export function evaluatePassword(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      score: 0,
      labelEn: "Empty",
      labelAr: "فارغ",
      colorClass: "text-muted-foreground",
      bgClass: "bg-muted",
      borderClass: "border-muted",
      rules: [
        { key: "length", labelEn: "8+ chars", labelAr: "8 أحرف على الأقل", met: false },
        { key: "uppercase", labelEn: "Uppercase (A-Z)", labelAr: "حرف كبير (A-Z)", met: false },
        { key: "lowercase", labelEn: "Lowercase (a-z)", labelAr: "حرف صغير (a-z)", met: false },
        { key: "number", labelEn: "Number (0-9)", labelAr: "رقم (0-9)", met: false },
        { key: "symbol", labelEn: "Symbol (!@#$)", labelAr: "رمز خاص (!@#$)", met: false },
      ],
      isValid: false,
    };
  }

  const rules: PasswordRule[] = [
    {
      key: "length",
      labelEn: "8+ chars",
      labelAr: "8 أحرف على الأقل",
      met: password.length >= 8,
    },
    {
      key: "uppercase",
      labelEn: "Uppercase (A-Z)",
      labelAr: "حرف كبير (A-Z)",
      met: /[A-Z]/.test(password),
    },
    {
      key: "lowercase",
      labelEn: "Lowercase (a-z)",
      labelAr: "حرف صغير (a-z)",
      met: /[a-z]/.test(password),
    },
    {
      key: "number",
      labelEn: "Number (0-9)",
      labelAr: "رقم (0-9)",
      met: /[0-9]/.test(password),
    },
    {
      key: "symbol",
      labelEn: "Symbol (!@#$)",
      labelAr: "رمز خاص (!@#$)",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const metCount = rules.filter((r) => r.met).length;

  // Backend requires min 8 chars, uppercase, lowercase, number (symbol is optional in default policy)
  const isBackendCompliant =
    rules[0].met && rules[1].met && rules[2].met && rules[3].met;

  let score = 1;
  let labelEn = "Weak";
  let labelAr = "ضعيفة";
  let colorClass = "text-rose-600 dark:text-rose-400";
  let bgClass = "bg-rose-500";
  let borderClass = "border-rose-500/30";

  if (metCount <= 2 || password.length < 6) {
    score = 1;
    labelEn = "Weak";
    labelAr = "ضعيفة";
    colorClass = "text-rose-600 dark:text-rose-400";
    bgClass = "bg-rose-500";
    borderClass = "border-rose-500/30";
  } else if (metCount === 3 || password.length < 8) {
    score = 2;
    labelEn = "Fair";
    labelAr = "مقبولة";
    colorClass = "text-amber-600 dark:text-amber-400";
    bgClass = "bg-amber-500";
    borderClass = "border-amber-500/30";
  } else if (metCount === 4) {
    score = 3;
    labelEn = "Good";
    labelAr = "جيدة";
    colorClass = "text-blue-600 dark:text-blue-400";
    bgClass = "bg-blue-500";
    borderClass = "border-blue-500/30";
  } else if (metCount === 5 && password.length >= 10) {
    score = 4;
    labelEn = "Very Strong";
    labelAr = "قوية جداً";
    colorClass = "text-emerald-600 dark:text-emerald-400";
    bgClass = "bg-emerald-500";
    borderClass = "border-emerald-500/30";
  } else {
    score = 4;
    labelEn = "Strong";
    labelAr = "قوية";
    colorClass = "text-emerald-600 dark:text-emerald-400";
    bgClass = "bg-emerald-500";
    borderClass = "border-emerald-500/30";
  }

  return {
    score,
    labelEn,
    labelAr,
    colorClass,
    bgClass,
    borderClass,
    rules,
    isValid: isBackendCompliant,
  };
}

interface PasswordStrengthMeterProps {
  password: string;
  isArabic?: boolean;
  showRules?: boolean;
}

export function PasswordStrengthMeter({
  password,
  isArabic = false,
  showRules = true,
}: PasswordStrengthMeterProps) {
  const result = useMemo(() => evaluatePassword(password), [password]);

  if (!password) {
    return (
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{isArabic ? "مستوى الأمان" : "Password Strength"}</span>
          <span>{isArabic ? "مطلوبة" : "Required"}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
          <div className="h-full rounded-full bg-muted/40" />
          <div className="h-full rounded-full bg-muted/40" />
          <div className="h-full rounded-full bg-muted/40" />
          <div className="h-full rounded-full bg-muted/40" />
        </div>
        {showRules && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {result.rules.map((rule) => (
              <span
                key={rule.key}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-border/50 bg-muted/20 text-muted-foreground transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                {isArabic ? rule.labelAr : rule.labelEn}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-1 animate-fade-in">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {isArabic ? "مستوى الأمان:" : "Password Strength:"}
        </span>
        <span className={cn("font-semibold tracking-wide", result.colorClass)}>
          {isArabic ? result.labelAr : result.labelEn}
        </span>
      </div>

      {/* 4-Segment Bar */}
      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
        {[1, 2, 3, 4].map((step) => {
          const isActive = result.score >= step;
          return (
            <div
              key={step}
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isActive ? result.bgClass : "bg-muted/40",
              )}
            />
          );
        })}
      </div>

      {/* Live Rule Checklist Chips */}
      {showRules && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {result.rules.map((rule) => (
            <span
              key={rule.key}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all duration-200",
                rule.met
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium"
                  : "bg-muted/30 text-muted-foreground border-border/40",
              )}
            >
              {rule.met ? (
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
              ) : (
                <X className="w-3 h-3 text-muted-foreground/60" />
              )}
              {isArabic ? rule.labelAr : rule.labelEn}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
