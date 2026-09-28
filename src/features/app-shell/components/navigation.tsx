"use client";

import type { LucideIcon } from "lucide-react";
import { FolderKanban, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  matches: (pathname: string) => boolean;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/",
    icon: MessageSquareText,
    label: "Feedback",
    matches: (pathname) => pathname === "/" || pathname.startsWith("/feedback"),
  },
  {
    href: "/projects",
    icon: FolderKanban,
    label: "Projects",
    matches: (pathname) => pathname.startsWith("/projects"),
  },
];

type NavigationLinksProps = {
  className?: string;
  onNavigate?: () => void;
};

export function NavigationLinks({
  className,
  onNavigate,
}: NavigationLinksProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className={cn("flex flex-col gap-1", className)}
    >
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const active = item.matches(pathname);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none [&_svg]:size-5 [&_svg]:shrink-0",
              active && "bg-accent text-accent-foreground",
            )}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
            prefetch={false}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
