"use client";

// ==============================================================================
// GapLens AI — Global Top Navigation & Responsive Workspace Bar
// Provides seamless navigation across all 6 screens, active workspace indicator,
// exam countdown, 1-Click Judge Demo launcher, and mobile menu drawer.
// ==============================================================================

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const { workspace, profile, isDemo, loginAsDemo, logout } = useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // If on login page, render minimal header
  if (pathname === "/login") {
    return (
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#0B0F19]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                GapLens <span className="text-cyan-400">AI</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 font-medium tracking-wide">
                See the gaps. Master what matters.
              </span>
            </div>
          </Link>

          <button
            onClick={() => loginAsDemo()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition"
          >
            <Zap className="h-3.5 w-3.5" />
            1-Click Judge Demo
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#0B0F19]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Brand & Workspace Indicator */}
        <div className="flex items-center gap-4 lg:gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/25 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-slate-950" />
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-extrabold tracking-tight text-white">
                GapLens <span className="text-cyan-400">AI</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 font-medium tracking-wide">
                Academic Intelligence
              </span>
            </div>
          </Link>

          {/* Active Workspace Badge */}
          <div className="hidden md:flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-full px-3 py-1 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-slate-200 truncate max-w-[190px]">
              {workspace?.title || "Operating Systems (CS-301)"}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 text-[10px] font-mono">
              <Clock className="h-3 w-3" />
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
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-cyan-400" : "text-slate-400")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action Section */}
        <div className="flex items-center gap-2.5">
          {/* Judge Acceleration Demo Button */}
          <button
            onClick={() => loginAsDemo()}
            title="Reset to pre-seeded OS CS-301 demo state"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500 transition"
          >
            <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
            <span className="hidden sm:inline">1-Click Judge Demo</span>
            <span className="sm:hidden">Demo</span>
          </button>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition"
            >
              <div className="h-6 w-6 rounded-full bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-300 text-[11px] font-bold">
                {profile?.full_name ? profile.full_name[0] : "A"}
              </div>
              <span className="hidden sm:inline truncate max-w-[100px]">
                {profile?.full_name?.split(" ")[0] || "Alex"}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-lg z-50 text-xs"
                onMouseLeave={() => setUserDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <p className="font-semibold text-slate-100">{profile?.full_name || "Alex Chen"}</p>
                  <p className="text-[11px] text-slate-400 truncate">{profile?.email || "demo@gapfinder.ai"}</p>
                  {isDemo && (
                    <span className="mt-1 inline-block rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-1.5 py-0.5 text-[10px] font-mono">
                      Judge Demo Mode
                    </span>
                  )}
                </div>

                <Link
                  href="/dashboard"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800/80 transition"
                >
                  <User className="h-3.5 w-3.5 text-cyan-400" />
                  Workspace Overview
                </Link>

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    loginAsDemo();
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800/80 transition"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  Reset OS CS-301 Demo
                </button>

                <div className="my-1 border-t border-slate-800" />

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-rose-400 hover:bg-rose-950/40 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-slate-950/95 p-4 space-y-2 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Active Course:</span>
            <span className="font-semibold text-cyan-300">{workspace?.title}</span>
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
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-cyan-400" : "text-slate-400")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
