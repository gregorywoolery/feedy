import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/features/app-shell/components";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Feedy", template: "%s · Feedy" },
  description: "Capture, review, filter, and export project feedback."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
