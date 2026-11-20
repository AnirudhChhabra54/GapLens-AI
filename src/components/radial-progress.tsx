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
  strokeWidth = 12,
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
  let strokeColor = "url(#cyanElectricGradient)";
  if (status === "weak" || (status === "default" && clampedValue < 55)) {
    strokeColor = "url(#weakGradient)";
  } else if (status === "medium" || (status === "default" && clampedValue < 80)) {
    strokeColor = "url(#mediumGradient)";
  } else if (status === "strong" || (status === "default" && clampedValue >= 80)) {
    strokeColor = "url(#strongGradient)";
  }

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <defs>
            <linearGradient id="cyanElectricGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="strongGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#14B8A6" />
            </linearGradient>
            <linearGradient id="mediumGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EAB308" />
            </linearGradient>
            <linearGradient id="weakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#F43F5E" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-800/80 fill-none"
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
          <span className="text-3xl font-extrabold tracking-tight text-slate-100">
            {Math.round(clampedValue)}%
          </span>
          {label && (
            <span className="text-[11px] font-medium tracking-wide uppercase text-cyan-400">
              {label}
            </span>
          )}
        </div>
      </div>

      {sublabel && (
        <span className="mt-2 text-xs text-slate-400 text-center font-medium max-w-[160px]">
          {sublabel}
        </span>
      )}
    </div>
  );
}
