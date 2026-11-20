"use client";

// ==============================================================================
// GapLens AI — Global Top Navigation & Responsive Workspace Bar
// Provides seamless navigation across all 6 screens, active workspace indicator,
// exam countdown, 1-Click Judge Demo launcher, and mobile menu drawer.
// ==============================================================================

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  FolderGit2,
  Stethoscope,
  BarChart3,
  CalendarCheck2,
  Zap,
  Menu,
  X,
  Clock,
  User,
  LogOut,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/materials", label: "Materials & Graph", icon: FolderGit2 },
  { href: "/diagnostic", label: "Diagnostic Lab", icon: Stethoscope },
  { href: "/gap-report", label: "Gap Report", icon: BarChart3 },
  { href: "/planner", label: "Planner & Copilot", icon: CalendarCheck2 },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, profile, isLoggedIn, isDemo, loginAsDemo, logout } = useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // If on login page, render minimal header
  if (pathname === "/login") {
    return (
      <header className="sticky top-0 z-50 border-b border-[rgba(183,255,232,0.08)] bg-[#080D0C]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-8 w-8 rounded-lg bg-[#0D1512] border border-[rgba(183,255,232,0.2)] flex items-center justify-center shadow-[0_0_15px_rgba(0,214,160,0.15)] group-hover:border-[#00D6A0] transition-colors">
              <Sparkles className="h-4 w-4 text-[#00D6A0]" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-[#F1F7F4] flex items-center gap-1.5">
                GAPLENS <span className="text-[#00D6A0] font-mono text-xs">/ AI</span>
              </span>
              <span className="text-[10px] text-[#6D7C74] block -mt-0.5 tracking-wider uppercase font-mono">
                Learning Intelligence
              </span>
            </div>
          </Link>

          <button
            onClick={() => loginAsDemo()}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00D6A0] to-[#00B887] px-4 py-1.5 text-xs font-semibold text-[#080D0C] shadow-[0_0_20px_rgba(0,214,160,0.25)] hover:shadow-[0_0_25px_rgba(0,214,160,0.4)] transition-all"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#080D0C] animate-pulse" />
            1-Click Judge Demo
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(183,255,232,0.08)] bg-[#080D0C]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Brand & Workspace Indicator */}
        <div className="flex items-center gap-4 lg:gap-6">
          <Link href="/" className="flex items-center gap-3 shrink-0 group">
            <div className="h-8 w-8 rounded-lg bg-[#0D1512] border border-[rgba(183,255,232,0.2)] flex items-center justify-center shadow-[0_0_15px_rgba(0,214,160,0.15)] group-hover:border-[#00D6A0] transition-colors">
              <Sparkles className="h-4 w-4 text-[#00D6A0]" />
            </div>
            <div className="hidden sm:block">
              <span className="text-base font-bold tracking-tight text-[#F1F7F4] flex items-center gap-1">
                GAPLENS <span className="text-[#00D6A0] font-mono text-xs">/ AI</span>
              </span>
              <span className="text-[10px] text-[#6D7C74] block -mt-0.5 tracking-wider uppercase font-mono">
                Academic Intelligence
              </span>
            </div>
          </Link>

          {/* Active Workspace Badge */}
          <div className="hidden md:flex items-center gap-2 bg-[#0D1512] border border-[rgba(183,255,232,0.12)] rounded-full px-3 py-1 text-xs">
            <span className="h-2 w-2 rounded-full bg-[#00D6A0] animate-pulse" />
            <span className="font-medium text-[#F1F7F4] truncate max-w-[190px]">
              {workspace?.title || "Operating Systems (CS-301)"}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[#121D18] text-[#B7FFE8] border border-[rgba(183,255,232,0.14)] px-2 py-0.5 text-[10px] font-mono">
              <Clock className="h-3 w-3 text-[#00D6A0]" />
              14d left
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  isActive
                    ? "text-[#F1F7F4] bg-[#121D18] border border-[rgba(183,255,232,0.16)] shadow-[0_0_15px_rgba(0,214,160,0.1)]"
                    : "text-[#A0ADA6] hover:text-[#F1F7F4] hover:bg-[#0D1512]"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-[#00D6A0]" : "text-[#6D7C74]")} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 w-4 h-0.5 bg-[#00D6A0] rounded-full shadow-[0_0_6px_#00D6A0]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Action Section */}
        <div className="flex items-center gap-2.5">
          {/* Judge Demo Button */}
          <button
            onClick={() => loginAsDemo()}
            title="Reset to pre-seeded OS CS-301 demo state"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#00D6A0] to-[#00B887] px-3.5 py-1.5 text-xs font-semibold text-[#080D0C] shadow-[0_0_18px_rgba(0,214,160,0.25)] hover:shadow-[0_0_22px_rgba(0,214,160,0.4)] transition-all"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#080D0C] animate-pulse" />
            <span className="hidden sm:inline">1-Click Judge Demo</span>
            <span className="sm:hidden">Demo</span>
          </button>

          {/* User Profile Menu or Sign In */}
          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-[rgba(183,255,232,0.10)] bg-[#0D1512] px-2.5 py-1.5 text-xs font-medium text-[#F1F7F4] hover:bg-[#121D18] transition"
              >
                <div className="h-5 w-5 rounded-full bg-[#121D18] border border-[#00D6A0]/40 flex items-center justify-center text-[#00D6A0] text-[10px] font-mono font-bold">
                  {profile?.full_name ? profile.full_name[0] : "A"}
                </div>
                <span className="hidden sm:inline truncate max-w-[90px]">
                  {profile?.full_name?.split(" ")[0] || "Alex"}
                </span>
                <ChevronDown className="h-3 w-3 text-[#6D7C74]" />
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-[rgba(183,255,232,0.14)] bg-[#0D1512]/95 p-2 shadow-2xl backdrop-blur-xl z-50 text-xs"
                  onMouseLeave={() => setUserDropdownOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-[rgba(183,255,232,0.08)] mb-1">
                    <p className="font-semibold text-[#F1F7F4]">{profile?.full_name || "Alex Chen"}</p>
                    <p className="text-[11px] text-[#A0ADA6] truncate">{profile?.email || "demo@gapfinder.ai"}</p>
                    {isDemo && (
                      <span className="mt-1 inline-block rounded-full bg-[#121D18] text-[#00D6A0] border border-[rgba(0,214,160,0.3)] px-2 py-0.5 text-[9px] font-mono">
                        Judge Demo Mode
                      </span>
                    )}
                  </div>

                  <Link
                    href="/dashboard"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[#A0ADA6] hover:text-[#F1F7F4] hover:bg-[#121D18] transition"
                  >
                    <User className="h-3.5 w-3.5 text-[#00D6A0]" />
                    Workspace Overview
                  </Link>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      loginAsDemo();
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[#A0ADA6] hover:text-[#F1F7F4] hover:bg-[#121D18] transition"
                  >
                    <Zap className="h-3.5 w-3.5 text-[#B7FFE8]" />
                    Reset OS CS-301 Demo
                  </button>

                  <div className="my-1 border-t border-[rgba(183,255,232,0.08)]" />

                  <button
                    onClick={async () => {
                      setUserDropdownOpen(false);
                      await logout();
                      router.push("/login");
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[#F87171] hover:bg-[rgba(248,113,113,0.1)] transition"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#00D6A0]/40 bg-[#121D18] px-3 py-1.5 text-xs font-semibold text-[#00D6A0] hover:bg-[#17231D] hover:border-[#00D6A0] transition"
            >
              <User className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg border border-[rgba(183,255,232,0.10)] bg-[#0D1512] text-[#A0ADA6] hover:text-[#F1F7F4]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[rgba(183,255,232,0.08)] bg-[#080D0C]/98 p-4 space-y-2 backdrop-blur-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(183,255,232,0.08)] text-xs">
            <span className="text-[#6D7C74] font-medium">Active Course:</span>
            <span className="font-semibold text-[#00D6A0]">{workspace?.title}</span>
          </div>

          <div className="space-y-1 pt-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition",
                    isActive
                      ? "bg-[#121D18] text-[#F1F7F4] border border-[rgba(183,255,232,0.16)]"
                      : "text-[#A0ADA6] hover:bg-[#0D1512] hover:text-[#F1F7F4]"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-[#00D6A0]" : "text-[#6D7C74]")} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[rgba(183,255,232,0.08)] mt-2">
            {isLoggedIn ? (
              <button
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await logout();
                  router.push("/login");
                }}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#F87171] hover:bg-[rgba(248,113,113,0.1)] transition"
              >
                <LogOut className="h-4 w-4" />
                Sign Out ({profile?.full_name?.split(" ")[0] || "User"})
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#00D6A0] hover:bg-[#121D18] transition"
              >
                <User className="h-4 w-4" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
