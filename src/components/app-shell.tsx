"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  Stethoscope,
  BarChart3,
  CalendarCheck2,
  MessageSquare,
  LogOut,
  Menu,
  X,
  ChevronRight,
  BookOpen,
  Calendar,
  Sparkles,
  User,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { cn } from "@/lib/utils";
import { CopilotDrawer } from "@/components/copilot-drawer";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/materials", label: "Course materials", icon: FolderGit2 },
  { href: "/diagnostic", label: "Diagnostic lab", icon: Stethoscope },
  { href: "/gap-report", label: "Learning gaps", icon: BarChart3 },
  { href: "/planner", label: "Study plan", icon: CalendarCheck2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, profile, loginAsDemo, logout } = useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const isPublicRoute = pathname === "/" || pathname === "/login";

  // Public Shell: Minimal top navigation and simple editorial footer
  if (isPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col bg-canvas text-brandText-primary">
        <header className="sticky top-0 z-40 border-b border-brandBorder bg-surface/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-7 w-7 rounded-control bg-accent flex items-center justify-center text-white shadow-subtle group-hover:bg-accent-hover transition-colors">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-semibold text-base tracking-tight text-brandText-primary">
                GapLens AI
              </span>
            </Link>

            <nav className="flex items-center gap-3 text-sm font-medium">
              <Link
                href="/login?mode=signup"
                className="px-3 py-1.5 rounded-control text-xs font-medium text-brandText-secondary hover:text-brandText-primary hover:bg-surface-subtle transition-colors"
              >
                Create account
              </Link>
              <button
                type="button"
                onClick={() => {
                  loginAsDemo();
                  router.push("/dashboard");
                }}
                className="px-4 py-2 rounded-control bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-subtle transition-all"
              >
                Demo
              </button>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-brandBorder bg-surface py-8 text-xs text-brandText-muted">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-brandText-primary">GapLens AI</span>
              <span>—</span>
              <span className="text-brandText-secondary">See the gaps. Master what matters.</span>
            </div>
            <div className="text-brandText-muted">
              Evidence-Grounded Study Diagnostics & Revision Planning
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Authenticated Application Shell (Sidebar + Top Bar + Main Workspace)
  return (
    <div className="min-h-screen flex bg-canvas text-brandText-primary">
      {/* 1. Desktop Left Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 z-30 border-r border-brandBorder bg-surface">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center border-b border-brandBorder">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-control bg-accent flex items-center justify-center text-white shadow-subtle">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-brandText-primary block leading-none">
                GapLens AI
              </span>
              <span className="text-[10px] text-brandText-muted tracking-wide uppercase font-medium">
                Academic Intelligence
              </span>
            </div>
          </Link>
        </div>

        {/* Active Course Selector */}
        <div className="p-3 border-b border-brandBorder bg-surface-subtle/50">
          <div className="px-3 py-2 rounded-card border border-brandBorder bg-surface text-left">
            <span className="text-[11px] font-medium text-brandText-muted block uppercase tracking-wider mb-0.5">
              Active Course
            </span>
            <span className="text-xs font-semibold text-brandText-primary block truncate">
              {workspace?.title || "Operating Systems (CS-301)"}
            </span>
          </div>
        </div>

        {/* Main Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-card text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent-soft text-accent font-semibold"
                    : "text-brandText-secondary hover:bg-surface-subtle hover:text-brandText-primary"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-accent" : "text-brandText-muted")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Account / Sign Out Footer */}
        <div className="p-4 border-t border-brandBorder bg-surface space-y-3">
          <div className="flex items-center gap-2.5 px-2">
            <div className="h-8 w-8 rounded-full bg-surface-subtle border border-brandBorder flex items-center justify-center text-brandText-primary text-xs font-semibold shrink-0">
              {profile?.full_name ? profile.full_name[0] : "R"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-brandText-primary truncate">
                {profile?.full_name || "Reviewer"}
              </p>
              <p className="text-[11px] text-brandText-muted truncate">
                {profile?.email || "reviewer@gaplens.ai"}
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-control text-xs font-medium text-brandText-secondary hover:text-status-danger hover:bg-status-dangerSoft transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Top Utility Bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-brandBorder bg-surface/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-control border border-brandBorder text-brandText-secondary hover:bg-surface-subtle"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Context Breadcrumb / Course Title */}
            <div className="flex items-center gap-2 text-xs text-brandText-muted">
              <BookOpen className="h-3.5 w-3.5 text-accent shrink-0 hidden sm:block" />
              <span className="font-medium text-brandText-secondary truncate max-w-[200px] sm:max-w-none">
                {workspace?.title || "Operating Systems (CS-301)"}
              </span>
              {workspace?.exam_date && (
                <>
                  <span className="text-brandBorder-strong">•</span>
                  <span className="hidden md:inline-flex items-center gap-1 text-brandText-muted">
                    <Calendar className="h-3 w-3" />
                    <span>Exam: {workspace.exam_date}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Top Actions: Study Assistant (Copilot) Drawer Trigger */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCopilotOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-card bg-surface hover:bg-surface-subtle border border-brandBorder text-xs font-semibold text-brandText-primary shadow-subtle transition-all"
            >
              <MessageSquare className="h-3.5 w-3.5 text-accent" />
              <span>Ask study assistant</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* 3. Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-brandText-primary/30 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-surface border-r border-brandBorder p-5 flex flex-col shadow-dialog z-10">
            <div className="flex items-center justify-between pb-4 border-b border-brandBorder">
              <span className="font-semibold text-base text-brandText-primary">GapLens AI</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-control text-brandText-muted hover:bg-surface-subtle"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-card text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent-soft text-accent font-semibold"
                        : "text-brandText-secondary hover:bg-surface-subtle hover:text-brandText-primary"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-accent" : "text-brandText-muted")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-brandBorder">
              <button
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await logout();
                  router.push("/login");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-control text-xs font-medium text-status-danger hover:bg-status-dangerSoft transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Study Copilot Drawer */}
      <CopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
    </div>
  );
}
