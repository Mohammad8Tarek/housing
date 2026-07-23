/**
 * PullToRefreshIndicator.tsx
 * بيبين spinner أثناء السحب للتحديث
 */

import { RefreshCw, Loader2 } from "lucide-react";

interface Props {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number; // 0..1
}

export default function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  progress,
}: Props) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const opacity = Math.min(progress, 1);
  const rotate = progress * 180;

  return (
    <div
      style={{
        position: "fixed",
        top: `max(env(safe-area-inset-top, 0px), ${Math.max(0, pullDistance - 24)}px)`,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: isRefreshing ? "top 0.2s" : "none",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "hsl(var(--card))",
          border: "0.5px solid hsl(var(--border2))",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity,
          transition: "opacity 0.15s",
        }}
      >
        {isRefreshing ? (
          <Loader2
            style={{
              width: "18px",
              height: "18px",
              color: "hsl(var(--accent2))",
              animation: "spin 0.8s linear infinite",
            }}
          />
        ) : (
          <RefreshCw
            style={{
              width: "18px",
              height: "18px",
              color:
                progress >= 1 ? "hsl(var(--accent2))" : "hsl(var(--muted2))",
              transform: `rotate(${rotate}deg)`,
              transition: "color 0.15s",
            }}
          />
        )}
      </div>
    </div>
  );
}
