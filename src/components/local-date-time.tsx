"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const fallbackFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
  timeZoneName: "short",
  year: "numeric",
});

export function formatLocalDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function LocalDateTime({
  value,
  prefix,
  className,
}: {
  value: string;
  prefix?: string;
  className?: string;
}) {
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const formatted = isHydrated
    ? formatLocalDateTime(value)
    : fallbackFormatter.format(new Date(value));

  return (
    <time className={cn(className)} dateTime={value}>
      {prefix}
      {formatted}
    </time>
  );
}
