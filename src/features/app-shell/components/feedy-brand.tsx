import Link from "next/link"
import { MessageSquareText } from "lucide-react"

import { cn } from "@/lib/utils"

type FeedyBrandProps = {
  className?: string
  compact?: boolean
}

export function FeedyBrand({ className, compact = false }: FeedyBrandProps) {
  return (
    <Link
      aria-label="Feedy feedback dashboard"
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 rounded-md font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      href="/"
      prefetch={false}
    >
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm [&_svg]:size-5">
        <MessageSquareText aria-hidden="true" />
      </span>
      {compact ? null : (
        <span className="text-xl">
          feedy<span className="text-primary">.</span>
        </span>
      )}
    </Link>
  )
}
