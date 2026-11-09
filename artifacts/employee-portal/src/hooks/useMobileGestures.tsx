import { useRef } from "react";

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
}: SwipeOptions) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
    touchStartY.current = e.changedTouches[0].screenY;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    touchEndY.current = e.changedTouches[0].screenY;
    handleSwipe();
  };

  const handleSwipe = () => {
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchStartY.current - touchEndY.current;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > threshold && onSwipeLeft) {
        onSwipeLeft();
      } else if (diffX < -threshold && onSwipeRight) {
        onSwipeRight();
      }
    } else {
      if (diffY > threshold && onSwipeUp) {
        onSwipeUp();
      } else if (diffY < -threshold && onSwipeDown) {
        onSwipeDown();
      }
    }
  };

  return { handleTouchStart, handleTouchEnd };
}

export function useHapticFeedback() {
  return {
    tap: () => {
      if ("vibrate" in navigator) {
        navigator.vibrate(10);
      }
    },
    success: () => {
      if ("vibrate" in navigator) {
        navigator.vibrate([10, 20, 10]);
      }
    },
    error: () => {
      if ("vibrate" in navigator) {
        navigator.vibrate([30, 30, 30]);
      }
    },
  };
}
