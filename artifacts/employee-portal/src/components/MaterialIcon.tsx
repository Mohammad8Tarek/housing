interface Props {
  icon: string;
  size?: number;
  className?: string;
  fill?: boolean;
  style?: React.CSSProperties;
}

export default function MaterialIcon({
  icon,
  size = 20,
  className = "",
  fill = false,
  style,
}: Props) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0`,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {icon}
    </span>
  );
}
