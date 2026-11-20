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
      <body className="min-h-screen bg-[#080D0C] text-[#F1F7F4] antialiased selection:bg-[#00D6A0] selection:text-[#080D0C]">
        <WorkspaceProvider>
          <div className="flex min-h-screen flex-col">
            <Navigation />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-[rgba(183,255,232,0.08)] bg-[#080D0C]/90 py-6 text-center text-xs text-[#6D7C74]">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#F1F7F4] tracking-tight">GapLens AI</span>
                  <span className="text-[#6D7C74]">—</span>
                  <span className="text-[#A0ADA6]">See the gaps. Master what matters.</span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-[#A0ADA6]">
                  <span className="rounded-full bg-[#0D1512] border border-[rgba(183,255,232,0.12)] px-2.5 py-0.5 font-mono text-[#00D6A0]">
                    Pre-seeded OS CS-301 Workspace
                  </span>
                  <span className="font-mono text-[#6D7C74]">Evidence-Grounded Intelligence</span>
                </div>
              </div>
            </footer>
          </div>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
