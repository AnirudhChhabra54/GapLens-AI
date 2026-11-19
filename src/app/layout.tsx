import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceProvider } from "@/components/workspace-context";
import { Navigation } from "@/components/navigation";

export const metadata: Metadata = {
  title: "GapLens AI — See the gaps. Master what matters.",
  description:
    "Autonomous academic intelligence platform providing syllabus-grounded knowledge diagnosis, Bayesian mastery math, confidence blind-spot detection, and time-budgeted revision scheduling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] antialiased selection:bg-cyan-500 selection:text-slate-950">
        <WorkspaceProvider>
          <div className="flex min-h-screen flex-col">
            <Navigation />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-slate-800/80 bg-[#0A0F1D]/80 py-6 text-center text-xs text-slate-500">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-300">GapLens AI</span>
                  <span>—</span>
                  <span>See the gaps. Master what matters.</span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-400">
                  <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-cyan-400">
                    Pre-seeded OS CS-301 Workspace
                  </span>
                  <span>Autonomous Evaluation Ready</span>
                </div>
              </div>
            </footer>
          </div>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
