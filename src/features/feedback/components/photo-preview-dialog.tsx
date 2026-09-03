"use client";

import { Maximize2 } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function PhotoPreviewDialog({ src, filename, children }: { src: string; filename: string; children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 pr-16">
          <DialogTitle className="truncate">{filename}</DialogTitle>
          <DialogDescription>Full-size feedback image</DialogDescription>
        </DialogHeader>
        <div className="relative min-h-[60dvh] flex-1 bg-muted/60">
          <Image alt={filename} className="object-contain p-4" fill sizes="95vw" src={src} unoptimized />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PhotoPreviewOverlay() {
  return <span className="pointer-events-none absolute bottom-2 right-2 inline-flex size-9 items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm"><Maximize2 aria-hidden="true" className="size-4" /></span>;
}
