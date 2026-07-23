// @ts-nocheck
import { Loader2 } from "lucide-react";

export function Loader({ className }: { className?: string }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className || ""}`} />;
}

export function PageLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center min-h-[400px]">
      <Loader className="h-8 w-8 text-primary" />
    </div>
  );
}
