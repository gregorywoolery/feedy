import { Database } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FeedyBrand } from "@/features/app-shell/components/feedy-brand"
import { NavigationLinks } from "@/features/app-shell/components/navigation"
import { RecentProjects } from "@/features/app-shell/components/recent-projects"

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card px-4 py-5 lg:flex">
      <div className="px-2">
        <FeedyBrand />
      </div>

      <Separator className="my-5" />

      <NavigationLinks />

      <RecentProjects className="mt-6 max-h-72" />

      <div className="mt-auto flex flex-col gap-3 rounded-lg border bg-muted/50 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4">
            <Database aria-hidden="true" />
            Workspace
          </span>
          <Badge variant="secondary">Local</Badge>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Open access while Feedy is running locally.
        </p>
      </div>
    </aside>
  )
}
