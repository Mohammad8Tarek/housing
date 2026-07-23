import { useEffect, useRef, useState, useCallback } from "react";

interface Options {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  containerRef?: React.RefObject<HTMLElement>;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 70,
  maxPull = 120,
  containerRef,
}: Options) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY = useRef(0);
  const isPulling = useRef(false);
  const isTriggered = useRef(false);
  const pullDistRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const getScrollTop = useCallback(() => {
    const el = containerRef?.current ?? document.documentElement;
    return el.scrollTop;
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef?.current ?? document.documentElement;

    const onTouchStart = (e: TouchEvent) => {
      if (getScrollTop() > 0) return;
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
      isTriggered.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;
      if (getScrollTop() > 0) {
        isPulling.current = false;
        return;
      }

      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) return;

      const resistance = Math.min(dy * 0.5, maxPull);
      pullDistRef.current = resistance;
      setPullDistance(resistance);

      if (dy > 10) e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (!isPulling.current) return;
      isPulling.current = false;

      if (pullDistRef.current >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        if ("vibrate" in navigator) navigator.vibrate([10, 20, 10]);
        try {
          await onRefreshRef.current();
        } finally {
          setIsRefreshing(false);
        }
      }

      pullDistRef.current = 0;
      setPullDistance(0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [isRefreshing, threshold, maxPull, getScrollTop, containerRef]);

  const progress = Math.min(pullDistance / threshold, 1);

  return { pullDistance, isRefreshing, progress };
}
