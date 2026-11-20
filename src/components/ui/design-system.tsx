"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

// ==============================================================================
// GapLens AI — Design System Primitives (DESIGN.md)
// Palette: Warm ivory canvas (#F7F5F0), surface (#FFFEFC), slate-blue (#4C6477),
// warm clay (#85553F), neutral charcoal typography (#252A2E, #5E666A, #687176).
// ==============================================================================

// 1. Status Badges
export type StatusVariant = "neutral" | "success" | "warning" | "danger" | "info" | "warm";

export function StatusBadge({
  variant = "neutral",
  label,
  icon: Icon,
  className,
}: {
  variant?: StatusVariant;
  label: string;
  icon?: LucideIcon;
  className?: string;
}) {
  const styles: Record<StatusVariant, string> = {
    neutral: "bg-surface-subtle text-brandText-secondary border-brandBorder",
    success: "bg-status-successSoft text-status-success border-[#C3DCCF]",
    warning: "bg-status-warningSoft text-status-warning border-[#E5D7B7]",
    danger: "bg-status-dangerSoft text-status-danger border-[#E4C9C7]",
    info: "bg-accent-soft text-accent border-[#C8D6DE]",
    warm: "bg-warm-soft text-warm border-[#DEC8BD]",
  };

  const dotColors: Record<StatusVariant, string> = {
    neutral: "bg-brandText-muted",
    success: "bg-status-success",
    warning: "bg-status-warning",
    danger: "bg-status-danger",
    info: "bg-accent",
    warm: "bg-warm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
        styles[variant],
        className
      )}
    >
      {Icon ? (
        <Icon className="h-3 w-3 shrink-0" />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColors[variant])} />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

// 2. Page Header
export function PageHeader({
  title,
  description,
  breadcrumb,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 space-y-3", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-brandText-muted">
          {breadcrumb.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-brandBorder-strong">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-brandText-primary transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-brandText-secondary font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-brandText-primary">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm text-brandText-secondary leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 flex items-center gap-3">{action}</div>}
      </div>

      {children && <div className="pt-2">{children}</div>}
    </div>
  );
}

// 3. Card Surface
export function Card({
  children,
  className,
  as: Component = "div",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  [key: string]: any;
}) {
  return (
    <Component
      className={cn(
        "rounded-panel border border-brandBorder bg-surface p-5 sm:p-6 shadow-subtle transition-all",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

// 4. Button Primitives
export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...props
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "quiet" | "destructive" | "warm";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  [key: string]: any;
}) {
  const base =
    "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-control gap-1.5",
    md: "px-4 py-2 text-sm rounded-card gap-2",
    lg: "px-5 py-2.5 text-base rounded-card gap-2.5",
  };

  const variants = {
    primary: "bg-accent hover:bg-accent-hover text-white shadow-subtle",
    secondary: "bg-surface hover:bg-surface-subtle text-brandText-primary border border-brandBorder",
    quiet: "bg-transparent hover:bg-surface-subtle text-brandText-secondary hover:text-brandText-primary",
    destructive: "bg-status-danger hover:bg-[#7A3E3B] text-white shadow-subtle",
    warm: "bg-warm hover:bg-warm-hover text-white shadow-subtle",
  };

  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

// 5. Empty State
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-panel border border-dashed border-brandBorder-strong bg-surface-subtle/50",
        className
      )}
    >
      {Icon && (
        <div className="h-10 w-10 rounded-full bg-surface border border-brandBorder flex items-center justify-center text-brandText-muted mb-3 shadow-subtle">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3 className="text-base font-semibold text-brandText-primary">{title}</h3>
      <p className="mt-1 text-sm text-brandText-secondary max-w-sm leading-relaxed mb-4">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
