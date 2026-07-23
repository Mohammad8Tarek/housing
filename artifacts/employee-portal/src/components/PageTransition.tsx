import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, type FC, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../hooks/useReducedMotion";
import { useTheme } from "../lib/theme";
import MaterialIcon from "./MaterialIcon";

interface LoginSignatureTransitionProps {
  show: boolean;
  onComplete: () => void;
}

export function LoginSignatureTransition({
  show,
  onComplete,
}: LoginSignatureTransitionProps) {
  const reduced = usePrefersReducedMotion();
  const { lang } = useTheme();
  const rtl = lang === "ar";

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onComplete, reduced ? 0 : 1100);
    return () => clearTimeout(t);
  }, [show, reduced, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-accent2/20 via-accent2/10 to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.4 }}
          />

          <motion.div
            className="relative w-24 h-24 rounded-full bg-accent2 flex items-center justify-center shadow-2xl"
            initial={
              reduced
                ? { scale: 1, opacity: 1 }
                : { scale: 0.4, opacity: 0 }
            }
            animate={
              reduced
                ? { scale: 1, opacity: 1 }
                : {
                    scale: [0.4, 1.15, 1],
                    opacity: [0, 1, 1],
                  }
            }
            exit={
              reduced
                ? { opacity: 0 }
                : { scale: 1.4, opacity: 0 }
            }
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.7, times: [0, 0.6, 1], ease: "easeOut" }
            }
          >
            <motion.span
              className="text-accent2-foreground"
              initial={reduced ? false : { scale: 0.6, rotate: -45 }}
              animate={
                reduced ? false : { scale: 1, rotate: [-45, 10, 0] }
              }
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.7, times: [0, 0.5, 1], ease: "easeOut" }
              }
            >
              <MaterialIcon icon="check" size={36} />
            </motion.span>

            {!reduced && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-accent2/40"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-accent2/30"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.6, opacity: 0 }}
                  transition={{ duration: 1.1, delay: 0.35, ease: "easeOut" }}
                />
              </>
            )}
          </motion.div>

          <motion.div
            className="absolute top-[58%] text-center px-6"
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={reduced ? false : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.3, delay: 0.45, ease: "easeOut" }
            }
          >
            <p
              className="text-xs font-bold text-foreground/80 tracking-wide"
              dir={rtl ? "rtl" : "ltr"}
            >
              {rtl ? "مرحبًا بعودتك" : "Welcome back"}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PageTransitionProps {
  pageKey: string;
  children: ReactNode;
}

const variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const PageTransition: FC<PageTransitionProps> = ({
  pageKey,
  children,
}) => {
  const reduced = usePrefersReducedMotion();
  const { lang } = useTheme();
  const rtl = lang === "ar";

  return (
    <motion.div
      key={pageKey}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }}
      dir={rtl ? "rtl" : "ltr"}
      style={{ width: "100%", minHeight: "100%" }}
    >
      {children}
    </motion.div>
  );
};

interface TabTransitionProps {
  tabKey: string;
  children: ReactNode;
  distance?: number;
}

export const TabTransition: FC<TabTransitionProps> = ({
  tabKey,
  children,
  distance = 12,
}) => {
  const reduced = usePrefersReducedMotion();
  const { lang } = useTheme();
  const rtl = lang === "ar";

  const tabVariants = {
    initial: {
      opacity: 0,
      x: rtl ? distance : -distance,
    },
    animate: { opacity: 1, x: 0 },
    exit: {
      opacity: 0,
      x: rtl ? -distance : distance,
    },
  };

  return (
    <motion.div
      key={tabKey}
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: reduced ? 0 : 0.22, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

export function useSignatureTransition() {
  const [active, setActive] = useState(false);
  return {
    trigger: () => setActive(true),
    complete: () => setActive(false),
    isActive: active,
  };
}
