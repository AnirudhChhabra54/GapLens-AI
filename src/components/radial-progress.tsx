"use client";

// ==============================================================================
// GapLens AI — Radial Progress Ring & Readiness Score Gauge
// Displays preparation coverage percentage with futuristic glowing gradient
// ==============================================================================

import React from "react";
import { cn } from "@/lib/utils";

interface RadialProgressProps {
  value: number; // 0 to 100
  size?: number; // diameter in px
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  className?: string;
  status?: "weak" | "medium" | "strong" | "default";
}

export function RadialProgress({
  value,
  size = 140,
  strokeWidth = 10,
  label,
  sublabel,
  className,
  status = "default",
}: RadialProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, isNaN(value) ? 0 : value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  // Color selection based on readiness
  let strokeColor = "url(#emeraldMintGradient)";
  if (status === "weak" || (status === "default" && clampedValue < 55)) {
    strokeColor = "url(#weakGradient)";
  } else if (status === "medium" || (status === "default" && clampedValue < 80)) {
    strokeColor = "url(#mediumGradient)";
  } else if (status === "strong" || (status === "default" && clampedValue >= 80)) {
    strokeColor = "url(#emeraldMintGradient)";
  }

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <defs>
            <linearGradient id="emeraldMintGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00D6A0" />
              <stop offset="100%" stopColor="#B7FFE8" />
            </linearGradient>
            <linearGradient id="mediumGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="weakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#121D18"
            strokeWidth={strokeWidth}
            className="fill-none"
          />

          {/* Animated progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="fill-none transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold tracking-tight text-[#F1F7F4] font-mono">
            {Math.round(clampedValue)}%
          </span>
          {label && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A0ADA6]">
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-[9px] text-[#6D7C74] font-mono">
              {sublabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
