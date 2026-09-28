"use client";

import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  FolderKanban,
  MessageSquareText,
  Plus,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import { type ComponentType, type SVGProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TableHead } from "@/components/ui/table";
import type {
  FeedbackListItem,
  FeedbackQuery,
  FeedbackSort,
} from "@/entities/contracts/feedback";
import type { ProjectOption } from "@/entities/contracts/project";
import { ProjectSheet } from "@/features/projects/components/project-sheet";
import { cn } from "@/lib/utils";

import { FeedbackSheet } from "./feedback-sheet";

type DashboardIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: DashboardIcon;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-xl border bg-card px-4 py-4 shadow-sm sm:px-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary [&_svg]:size-5">
        <Icon aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {value.toLocaleString()}
        </p>
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{helper}</p>
      </div>
    </div>
  );
}

export function ProjectIdentity({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "P";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
      >
        {initial}
      </span>
      <span
        className="min-w-0 truncate font-medium text-foreground"
        title={name}
      >
        {name}
      </span>
    </div>
  );
}

export function PhotoPreviewGroup({
  item,
  large = false,
}: {
  item: FeedbackListItem;
  large?: boolean;
}) {
  if (!item.photoCount) {
    return <span className="text-sm text-muted-foreground">No photos</span>;
  }

  const visiblePhotos = item.photos.slice(0, large ? 4 : 3);
  const remaining = Math.max(0, item.photoCount - visiblePhotos.length);

  return (
    <div
      className="flex items-center"
      aria-label={`${item.photoCount} attached ${item.photoCount === 1 ? "photo" : "photos"}`}
    >
      <div className="flex [&>*+*]:-ml-2">
        {visiblePhotos.map((photo, index) => (
          <span
            className={cn(
              "relative block overflow-hidden rounded-md border-2 border-card bg-muted shadow-sm",
              large ? "size-12" : "size-9",
            )}
            key={photo.id}
            style={{ zIndex: visiblePhotos.length - index }}
          >
            <Image
              alt={photo.originalFilename}
              className="object-cover"
              fill
              sizes={large ? "48px" : "36px"}
              src={photo.url}
              unoptimized
            />
          </span>
        ))}
      </div>
      {remaining ? (
        <span className="ml-2 text-xs font-medium tabular-nums text-muted-foreground">
          +{remaining}
        </span>
      ) : null}
    </div>
  );
}

export function SortableHead({
  field,
  label,
  query,
  onSort,
  className,
}: {
  field: FeedbackSort;
  label: string;
  query: FeedbackQuery;
  onSort: (field: FeedbackSort) => void;
  className?: string;
}) {
  const active = query.sort === field;
  const ariaSort = active
    ? query.order === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const SortIcon = active
    ? query.order === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowDownUp;

  return (
    <TableHead aria-sort={ariaSort} className={className}>
      <button
        className="-ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-left transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSort(field)}
        type="button"
      >
        {label}
        <SortIcon
          aria-hidden="true"
          className={cn("size-3.5", active ? "text-primary" : "opacity-50")}
        />
      </button>
    </TableHead>
  );
}

export function EmptyFeedbackState({
  hasFilters,
  projects,
  onClear,
}: {
  hasFilters: boolean;
  projects: ProjectOption[];
  onClear: () => void;
}) {
  if (hasFilters) {
    return (
      <Empty className="min-h-80 border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No matching feedback</EmptyTitle>
          <EmptyDescription>
            Try a broader search or remove one of the active filters.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onClear} type="button" variant="outline">
            <X aria-hidden="true" data-icon="inline-start" />
            Clear filters
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (!projects.length) {
    return (
      <Empty className="min-h-80 border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderKanban aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Create your first project</EmptyTitle>
          <EmptyDescription>
            Feedback is kept inside projects so versions, notes, and photos stay
            together.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ProjectSheet
            trigger={
              <Button type="button">
                <Plus aria-hidden="true" data-icon="inline-start" />
                New project
              </Button>
            }
          />
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="min-h-80 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquareText aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Add your first feedback</EmptyTitle>
        <EmptyDescription>
          Capture an observation, its project version, and any supporting
          photos.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <FeedbackSheet
          projects={projects}
          trigger={
            <Button type="button">
              <Plus aria-hidden="true" data-icon="inline-start" />
              New feedback
            </Button>
          }
        />
      </EmptyContent>
    </Empty>
  );
}
