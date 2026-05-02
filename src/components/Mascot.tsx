import { useId } from "react";
import type { Theme } from "../lib/themes";

export type MascotMood = "happy" | "cheer" | "sad" | "think";

type MascotProps = {
  size?: number;
  mood?: MascotMood;
  theme: Theme;
};

export function Mascot({ size = 56, mood = "happy", theme }: MascotProps) {
  const eyeY = mood === "cheer" ? 24 : mood === "sad" ? 28 : 26;
  const reactId = useId();
  const id = `mascot-${reactId}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      role="img"
    >
      <defs>
        <radialGradient id={id} cx="0.4" cy="0.35">
          <stop offset="0%" stopColor={theme.mascotFrom} />
          <stop offset="100%" stopColor={theme.mascotTo} />
        </radialGradient>
      </defs>
      <path
        d="M32 6 C 50 6 58 18 58 32 C 58 48 48 58 32 58 C 16 58 6 48 6 32 C 6 18 14 6 32 6 Z"
        fill={`url(#${id})`}
      />
      {mood === "cheer" ? (
        <>
          <path
            d="M18 26 Q 22 22 26 26"
            stroke="#1f1235"
            strokeWidth="2.8"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M38 26 Q 42 22 46 26"
            stroke="#1f1235"
            strokeWidth="2.8"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <ellipse
            cx="22"
            cy={eyeY}
            rx="3"
            ry={mood === "sad" ? 2.5 : 4}
            fill="#1f1235"
          />
          <ellipse
            cx="42"
            cy={eyeY}
            rx="3"
            ry={mood === "sad" ? 2.5 : 4}
            fill="#1f1235"
          />
          <circle cx="23" cy={eyeY - 1} r="1" fill="#fff" />
          <circle cx="43" cy={eyeY - 1} r="1" fill="#fff" />
        </>
      )}
      {mood === "happy" && (
        <path
          d="M24 38 Q 32 44 40 38"
          stroke="#1f1235"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {mood === "cheer" && (
        <path d="M22 36 Q 32 48 42 36 Q 32 44 22 36 Z" fill="#1f1235" />
      )}
      {mood === "sad" && (
        <path
          d="M24 42 Q 32 36 40 42"
          stroke="#1f1235"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {mood === "think" && <circle cx="32" cy="40" r="2" fill="#1f1235" />}
      <circle cx="16" cy="36" r="3" fill="#fbcfe8" opacity="0.75" />
      <circle cx="48" cy="36" r="3" fill="#fbcfe8" opacity="0.75" />
    </svg>
  );
}
