"use client"

import { Database, Menu } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { FeedyBrand } from "@/features/app-shell/components/feedy-brand"
import { NavigationLinks } from "@/features/app-shell/components/navigation"
import { RecentProjects } from "@/features/app-shell/components/recent-projects"

export function MobileNav() {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 lg:hidden">
      <FeedyBrand />

      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger asChild>
          <Button aria-label="Open navigation" size="icon-lg" variant="ghost">
            <Menu aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Workspace navigation</SheetTitle>
            <SheetDescription>
              Move between feedback and projects.
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-6">
            <NavigationLinks onNavigate={() => setOpen(false)} />

            <RecentProjects onNavigate={() => setOpen(false)} />

            <div className="mt-auto flex items-start gap-3 rounded-lg border bg-muted/50 p-4 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
              <Database aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Open workspace</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  No sign-in is required for this version.
                </p>
              </div>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </header>
  )
}
