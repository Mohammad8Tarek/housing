import React from "react";

interface ResidentQRCodeProps {
  data: string;
  size?: number;
  className?: string;
}

/**
 * Deterministic pseudo-random QR pattern renderer based on input hash
 * Produces crisp, beautiful QR matrix pattern for digital cards
 */
export function ResidentQRCode({
  data,
  size = 120,
  className = "",
}: ResidentQRCodeProps) {
  // Compute deterministic hash from string
  const hash = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < data.length; i++) {
      h = (Math.imul(31, h) + data.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }, [data]);

  // Generate 21x21 matrix (standard QR version 1 size)
  const matrix = React.useMemo(() => {
    const N = 21;
    const grid: boolean[][] = Array.from({ length: N }, () =>
      Array(N).fill(false),
    );

    // Helper: draw finder pattern at (r, c)
    const drawFinder = (r: number, c: number) => {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          const isOuter = i === 0 || i === 6 || j === 0 || j === 6;
          const isInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
          grid[r + i][c + j] = isOuter || isInner;
        }
      }
    };

    // 3 Finder patterns
    drawFinder(0, 0);
    drawFinder(0, N - 7);
    drawFinder(N - 7, 0);

    // Timing patterns
    for (let i = 8; i < N - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Fill data areas deterministically
    let seed = hash;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        // Skip finder areas
        if (
          (r < 8 && c < 8) ||
          (r < 8 && c >= N - 8) ||
          (r >= N - 8 && c < 8)
        ) {
          continue;
        }
        if (r === 6 || c === 6) continue;

        // Linear congruential pseudo-random bit
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        grid[r][c] = (seed >> 16) % 2 === 0;
      }
    }

    return grid;
  }, [hash]);

  const N = matrix.length;
  const cellSize = size / (N + 2); // 1 cell padding around

  return (
    <div
      className={`inline-flex items-center justify-center p-2 rounded-xl bg-white shadow-xs ${className}`}
      style={{ width: size, height: size }}
      title={`Resident QR: ${data}`}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={size} height={size} fill="#FFFFFF" rx="8" />
        {matrix.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null;
            const x = (c + 1) * cellSize;
            const y = (r + 1) * cellSize;
            return (
              <rect
                key={`${r}-${c}`}
                x={x}
                y={y}
                width={cellSize * 0.96}
                height={cellSize * 0.96}
                rx={cellSize * 0.2}
                fill="#111827"
              />
            );
          }),
        )}
      </svg>
    </div>
  );
}
