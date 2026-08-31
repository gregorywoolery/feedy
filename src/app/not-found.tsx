import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">That record was not found</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          It may have moved, or the link may be incomplete.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Return to feedback</Link>
      </Button>
    </div>
  );
}
