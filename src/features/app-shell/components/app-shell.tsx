import type { ReactNode } from "react";

import { MobileNav } from "@/features/app-shell/components/mobile-nav";
import { Sidebar } from "@/features/app-shell/components/sidebar";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  contentClassName?: string;
};

export function AppShell({ children, contentClassName }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-background">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 motion-reduce:transition-none"
        href="#main-content"
      >
        Skip to content
      </a>

      <Sidebar />

      <div className="min-w-0 lg:pl-60">
        <MobileNav />
        <main
          className={cn(
            "mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:min-h-dvh lg:px-8 lg:py-8",
            contentClassName,
          )}
          id="main-content"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
