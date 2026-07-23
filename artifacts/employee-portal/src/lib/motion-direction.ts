export function getDirectionalOffset(baseOffset: number, isRtl: boolean) {
  return isRtl ? -baseOffset : baseOffset;
}

export type MotionDirection = "forward" | "backward" | "enter" | "exit";

export interface DirectionalVariants {
  enter: (isRtl: boolean) => number;
  exit: (isRtl: boolean) => number;
}

export function createSlideVariants(distance: number) {
  return {
    enter: (isRtl: boolean) => ({
      x: getDirectionalOffset(distance, isRtl),
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (isRtl: boolean) => ({
      x: getDirectionalOffset(-distance, isRtl),
      opacity: 0,
    }),
  };
}
