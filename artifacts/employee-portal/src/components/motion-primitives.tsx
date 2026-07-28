import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { usePrefersReducedMotion } from "../hooks/useReducedMotion";
import { canHover } from "../lib/haptics";

const isHoverable = canHover();

interface MotionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  scale?: number;
  withTap?: boolean;
  withHover?: boolean;
}

export function MotionButton({
  children,
  scale = 0.97,
  withTap = true,
  withHover = false,
  style,
  ...rest
}: MotionButtonProps) {
  const animated = !usePrefersReducedMotion();

  const tap = animated && withTap ? { scale } : undefined;
  const hover =
    animated && withHover && isHoverable
      ? {
          scale: 1.01,
          transition: { duration: 0.15 },
        }
      : undefined;

  return (
    <motion.button
      whileTap={tap}
      whileHover={hover}
      style={{ ...style }}
      {...(rest as any)}
    >
      {children}
    </motion.button>
  );
}

interface MotionCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  lift?: number;
  tapScale?: number;
}

export function MotionCard({
  children,
  className,
  style,
  onClick,
  lift = -2,
  tapScale = 0.98,
}: MotionCardProps) {
  const animated = !usePrefersReducedMotion();

  return (
    <motion.div
      whileTap={animated ? { scale: tapScale } : undefined}
      whileHover={
        animated && isHoverable
          ? {
              y: lift,
              boxShadow: "0 8px 24px -10px rgba(0,0,0,0.18)",
            }
          : undefined
      }
      onClick={onClick}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  index: number;
  className?: string;
  style?: React.CSSProperties;
}

export function StaggerItem({
  children,
  index,
  className,
  style,
}: StaggerItemProps) {
  const animated = !usePrefersReducedMotion();

  return (
    <motion.div
      initial={animated ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: animated ? 0.22 : 0,
        delay: animated ? Math.min(index * 0.04, 0.24) : 0,
        ease: "easeOut",
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
