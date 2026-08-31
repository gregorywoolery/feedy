"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive [&_svg]:size-5">
        <AlertTriangle aria-hidden="true" />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Feedy could not load this view</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Check that PostgreSQL is running, then retry the request.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
