export function SkeletonCard({ height = "120px" }: { height?: string }) {
  return (
    <div
      style={{
        height,
        backgroundColor: "var(--bg-secondary, #f3f4f6)",
        borderRadius: "8px",
        animation: "pulse 1.5s infinite",
      }}
    />
  );
}
