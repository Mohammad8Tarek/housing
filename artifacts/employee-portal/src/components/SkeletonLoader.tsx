/**
 * SkeletonLoader.tsx — Skeleton Loading States
 * بدل الـ spinner — يبين شكل الصفحة قبل ما البيانات توصل
 */

function Pulse({
  w = "100%",
  h = 16,
  r = 8,
  className = "",
}: {
  w?: string | number;
  h?: number;
  r?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "hsl(var(--surface))",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

// الـ keyframes في index.css — أضفها مرة واحدة
// @keyframes skeleton-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }

export function SkeletonOverview() {
  return (
    <div
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Hero */}
      <div
        style={{
          background: "hsl(var(--card))",
          border: "0.5px solid hsl(var(--border2))",
          borderRadius: "24px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <Pulse w={80} h={20} r={10} />
        <Pulse w="60%" h={28} r={8} />
        <Pulse w="80%" h={14} r={6} />
        <div style={{ display: "flex", gap: "8px" }}>
          <Pulse w={100} h={36} r={12} />
          <Pulse w={100} h={36} r={12} />
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              background: "hsl(var(--card))",
              border: "0.5px solid hsl(var(--border2))",
              borderRadius: "16px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <Pulse w={36} h={36} r={10} />
            <Pulse w="60%" h={10} r={4} />
            <Pulse w="80%" h={14} r={4} />
          </div>
        ))}
      </div>

      {/* Accommodation card */}
      <div
        style={{
          background: "hsl(var(--card))",
          border: "0.5px solid hsl(var(--border2))",
          borderRadius: "24px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <Pulse w="50%" h={16} r={6} />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <Pulse w="35%" h={12} r={4} />
            <Pulse w="40%" h={12} r={4} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonRequests() {
  return (
    <div
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Form skeleton */}
      <div
        style={{
          background: "hsl(var(--card))",
          border: "0.5px solid hsl(var(--border2))",
          borderRadius: "20px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <Pulse w="40%" h={18} r={6} />
        <Pulse w="100%" h={44} r={10} />
        <Pulse w="100%" h={44} r={10} />
        <Pulse w="100%" h={80} r={10} />
        <Pulse w="100%" h={44} r={12} />
      </div>

      {/* History items */}
      <Pulse w="40%" h={14} r={4} />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: "hsl(var(--card))",
            border: "0.5px solid hsl(var(--border2))",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Pulse w="50%" h={14} r={4} />
            <Pulse w="60px" h={20} r={10} />
          </div>
          <Pulse w="80%" h={12} r={4} />
          <Pulse w="40%" h={10} r={4} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDocuments() {
  return (
    <div
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <Pulse w="50%" h={20} r={6} />
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: "hsl(var(--card))",
            border: "0.5px solid hsl(var(--border2))",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Pulse w={44} h={44} r={10} />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <Pulse w="60%" h={14} r={4} />
            <Pulse w="40%" h={10} r={4} />
          </div>
          <Pulse w={32} h={32} r={8} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div
      style={{
        background: "hsl(var(--card))",
        border: "0.5px solid hsl(var(--border2))",
        borderRadius: "16px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <Pulse w="70%" h={16} r={4} />
      <Pulse w="90%" h={12} r={4} />
      <Pulse w="50%" h={12} r={4} />
    </div>
  );
}
