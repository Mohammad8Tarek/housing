import React from "react";

interface Props {
  className?: string;
  isDark?: boolean;
}

export function WhatsAppDoodleBg({ className = "", isDark = false }: Props) {
  const fillColor = isDark ? "#ffffff" : "#000000";
  const opacity = isDark ? 0.04 : 0.05;

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      style={{
        backgroundColor: isDark ? "#0b141a" : "#efeae2",
      }}
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="wa-doodle-pattern"
            x="0"
            y="0"
            width="320"
            height="320"
            patternUnits="userSpaceOnUse"
          >
            <g fill={fillColor} fillOpacity={opacity}>
              {/* Chat Bubble 1 */}
              <path d="M20 20 h35 a10 10 0 0 1 10 10 v20 a10 10 0 0 1 -10 10 h-25 l-10 8 v-8 h0 a10 10 0 0 1 -10 -10 v-20 a10 10 0 0 1 10 -10 z" />
              {/* Clock */}
              <circle cx="120" cy="40" r="14" stroke={fillColor} strokeWidth="2" strokeOpacity={opacity} fill="none" />
              <path d="M120 32 v8 h6" stroke={fillColor} strokeWidth="2" strokeOpacity={opacity} fill="none" strokeLinecap="round" />
              {/* Coffee Mug */}
              <path d="M190 35 h20 a4 4 0 0 1 4 4 v16 a8 8 0 0 1 -8 8 h-12 a8 8 0 0 1 -8 -8 v-16 a4 4 0 0 1 4 -4 z M214 40 h4 a3 3 0 0 1 3 3 v6 a3 3 0 0 1 -3 3 h-4" stroke={fillColor} strokeWidth="2" strokeOpacity={opacity} fill="none" />
              {/* Heart */}
              <path d="M275 35 a5 5 0 0 0 -7 0 l-3 3 l-3 -3 a5 5 0 1 0 -7 7 l10 10 l10 -10 a5 5 0 0 0 0 -7 z" />
              {/* Star */}
              <polygon points="50,110 53,118 62,118 55,123 58,131 50,126 42,131 45,123 38,118 47,118" />
              {/* Smartphone */}
              <rect x="110" y="105" width="18" height="32" rx="4" stroke={fillColor} strokeWidth="2" strokeOpacity={opacity} fill="none" />
              <circle cx="119" cy="131" r="1.5" />
              {/* Paper Airplane */}
              <path d="M190 115 l25 -10 l-10 25 l-5 -10 z" />
              {/* Headphone */}
              <path d="M260 120 a14 14 0 0 1 28 0 v10 h-6 v-8 h6 a8 8 0 0 0 -16 0 v8 h-6 z" />
              {/* Speech Bubble 2 */}
              <path d="M35 190 h25 a8 8 0 0 1 8 8 v14 a8 8 0 0 1 -8 8 h-15 l-8 6 v-6 a8 8 0 0 1 -2 -5 v-17 a8 8 0 0 1 8 -8 z" />
              {/* Sun / Flower */}
              <circle cx="130" cy="205" r="7" />
              <circle cx="130" cy="193" r="2.5" />
              <circle cx="130" cy="217" r="2.5" />
              <circle cx="118" cy="205" r="2.5" />
              <circle cx="142" cy="205" r="2.5" />
              {/* Thumbs Up */}
              <path d="M200 215 v-10 a4 4 0 0 1 4 -4 l4 -6 a3 3 0 0 1 3 -1 h2 a3 3 0 0 1 3 3 v4 h8 a4 4 0 0 1 4 4 l-2 10 a4 4 0 0 1 -4 4 h-15 z" />
              {/* Music Note */}
              <path d="M275 195 v18 a5 5 0 1 1 -4 -4 v-14 h14 v12 a5 5 0 1 1 -4 -4 v-8 z" />
              {/* Camera */}
              <rect x="40" y="270" width="26" height="18" rx="3" stroke={fillColor} strokeWidth="2" strokeOpacity={opacity} fill="none" />
              <circle cx="53" cy="279" r="4.5" stroke={fillColor} strokeWidth="1.5" strokeOpacity={opacity} fill="none" />
              <rect x="45" y="266" width="6" height="4" rx="1" />
              {/* Globe */}
              <circle cx="125" cy="280" r="12" stroke={fillColor} strokeWidth="1.5" strokeOpacity={opacity} fill="none" />
              <ellipse cx="125" cy="280" rx="5" ry="12" stroke={fillColor} strokeWidth="1.5" strokeOpacity={opacity} fill="none" />
              <line x1="113" y1="280" x2="137" y2="280" stroke={fillColor} strokeWidth="1.5" strokeOpacity={opacity} />
              {/* Key */}
              <circle cx="205" cy="275" r="6" stroke={fillColor} strokeWidth="2" strokeOpacity={opacity} fill="none" />
              <path d="M211 275 h14 v4 h-3 v3 h-3 v-7" stroke={fillColor} strokeWidth="2" strokeOpacity={opacity} fill="none" />
              {/* Smiley Face */}
              <circle cx="275" cy="275" r="13" stroke={fillColor} strokeWidth="1.5" strokeOpacity={opacity} fill="none" />
              <circle cx="271" cy="271" r="1.5" />
              <circle cx="279" cy="271" r="1.5" />
              <path d="M269 278 q6 6 12 0" stroke={fillColor} strokeWidth="1.5" strokeOpacity={opacity} fill="none" strokeLinecap="round" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wa-doodle-pattern)" />
      </svg>
    </div>
  );
}
