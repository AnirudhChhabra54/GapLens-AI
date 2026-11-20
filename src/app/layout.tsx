import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceProvider } from "@/components/workspace-context";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "GapLens AI — See the gaps. Master what matters.",
  description:
    "Evidence-grounded study diagnostic platform providing syllabus-grounded knowledge diagnosis, confidence blind-spot detection, and realistic revision planning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-brandText-primary antialiased">
        <WorkspaceProvider>
          <AppShell>{children}</AppShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
