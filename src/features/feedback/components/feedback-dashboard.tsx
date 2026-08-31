"use client";

import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileDown,
  FolderKanban,
  Images,
  Loader2,
  MessageSquareText,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ComponentType,
  type SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition
} from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LocalDateTime } from "@/components/local-date-time";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type {
  FeedbackListItem,
  FeedbackPage,
  FeedbackQuery,
  FeedbackSort,
  FeedbackSummary,
  SortOrder
} from "@/entities/contracts/feedback";
import type { ProjectOption } from "@/entities/contracts/project";
import { ProjectSheet } from "@/features/projects/components/project-sheet";
import { cn } from "@/lib/utils";

import { DeleteFeedbackDialog } from "./delete-feedback-dialog";
import { FeedbackSheet } from "./feedback-sheet";

type FeedbackDashboardProps = {
  page: FeedbackPage;
  summary: FeedbackSummary;
  projects: ProjectOption[];
  versions: string[];
  query: FeedbackQuery;
};

type QueryPatch = Partial<Record<keyof FeedbackQuery, string | number | undefined>>;
type DashboardIcon = ComponentType<SVGProps<SVGSVGElement>>;

const ALL_PROJECTS = "__all_projects";
const ALL_VERSIONS = "__all_versions";

function searchParamsFromQuery(query: FeedbackQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.project) params.set("project", query.project);
  if (query.version) params.set("version", query.version);
  if (query.hasPhotos !== "all") params.set("hasPhotos", query.hasPhotos);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.sort !== "createdAt") params.set("sort", query.sort);
  if (query.order !== "desc") params.set("order", query.order);
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.pageSize !== 25) params.set("pageSize", String(query.pageSize));
  return params;
}

function getExportFilename(contentDisposition: string | null) {
  if (!contentDisposition) return "feedy-feedback-export.pdf";

  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].replace(/["']/g, ""));
    } catch {
      return "feedy-feedback-export.pdf";
    }
  }

  const regularMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return regularMatch?.[1] ?? "feedy-feedback-export.pdf";
}

function getVisiblePages(currentPage: number, pageCount: number) {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const start = Math.min(Math.max(currentPage - 2, 1), pageCount - 4);
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper
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

function ProjectIdentity({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "P";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
      >
        {initial}
      </span>
      <span className="min-w-0 truncate font-medium text-foreground" title={name}>
        {name}
      </span>
    </div>
  );
}

function PhotoPreviewGroup({ item, large = false }: { item: FeedbackListItem; large?: boolean }) {
  if (!item.photoCount) {
    return <span className="text-sm text-muted-foreground">No photos</span>;
  }

  const visiblePhotos = item.photos.slice(0, large ? 4 : 3);
  const remaining = Math.max(0, item.photoCount - visiblePhotos.length);

  return (
    <div className="flex items-center" aria-label={`${item.photoCount} attached ${item.photoCount === 1 ? "photo" : "photos"}`}>
      <div className="flex [&>*+*]:-ml-2">
        {visiblePhotos.map((photo, index) => (
          <span
            className={cn(
              "relative block overflow-hidden rounded-md border-2 border-card bg-muted shadow-sm",
              large ? "size-12" : "size-9"
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
        <span className="ml-2 text-xs font-medium tabular-nums text-muted-foreground">+{remaining}</span>
      ) : null}
    </div>
  );
}

function SortableHead({
  field,
  label,
  query,
  onSort,
  className
}: {
  field: FeedbackSort;
  label: string;
  query: FeedbackQuery;
  onSort: (field: FeedbackSort) => void;
  className?: string;
}) {
  const active = query.sort === field;
  const ariaSort = active ? (query.order === "asc" ? "ascending" : "descending") : "none";
  const SortIcon = active ? (query.order === "asc" ? ArrowUp : ArrowDown) : ArrowDownUp;

  return (
    <TableHead aria-sort={ariaSort} className={className}>
      <button
        className="-ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-left transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSort(field)}
        type="button"
      >
        {label}
        <SortIcon aria-hidden="true" className={cn("size-3.5", active ? "text-primary" : "opacity-50")} />
      </button>
    </TableHead>
  );
}

function EmptyFeedbackState({
  hasFilters,
  projects,
  onClear
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
            Feedback is kept inside projects so versions, notes, and photos stay together.
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
          Capture an observation, its project version, and any supporting photos.
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

export function FeedbackDashboard({
  page,
  summary,
  projects,
  versions,
  query
}: FeedbackDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startNavigation] = useTransition();
  const [searchValue, setSearchValue] = useState(query.q);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingFiltered, setIsExportingFiltered] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");

  const updateQuery = useCallback(
    (patch: QueryPatch, mode: "push" | "replace" = "push") => {
      const params =
        typeof window === "undefined"
          ? searchParamsFromQuery(query)
          : new URLSearchParams(window.location.search);

      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, String(value));
      }

      const destination = params.size ? `${pathname}?${params.toString()}` : pathname;
      startNavigation(() => {
        if (mode === "replace") router.replace(destination, { scroll: false });
        else router.push(destination, { scroll: false });
      });
    },
    [pathname, query, router]
  );

  useEffect(() => {
    if (searchValue === query.q) return;
    const timeout = window.setTimeout(() => {
      updateQuery({ q: searchValue.trim() || undefined, page: undefined }, "replace");
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [query.q, searchValue, updateQuery]);

  const activeFilterCount = [
    Boolean(query.q),
    Boolean(query.project),
    Boolean(query.version),
    query.hasPhotos !== "all",
    Boolean(query.from),
    Boolean(query.to)
  ].filter(Boolean).length;

  const currentPageIds = useMemo(() => page.items.map((item) => item.id), [page.items]);
  const selectedInVisibleOrder = useMemo(
    () => currentPageIds.filter((id) => selectedIds.has(id)),
    [currentPageIds, selectedIds]
  );
  const allCurrentPageSelected =
    currentPageIds.length > 0 && selectedInVisibleOrder.length === currentPageIds.length;
  const someCurrentPageSelected =
    selectedInVisibleOrder.length > 0 && !allCurrentPageSelected;

  const visiblePages = getVisiblePages(page.page, page.pageCount);
  const firstVisibleResult = page.total ? (page.page - 1) * page.pageSize + 1 : 0;
  const lastVisibleResult = Math.min(page.page * page.pageSize, page.total);

  function clearFilters() {
    setSearchValue("");
    startNavigation(() => router.push(pathname, { scroll: false }));
  }

  function sortBy(field: FeedbackSort) {
    const nextOrder: SortOrder = query.sort === field && query.order === "desc" ? "asc" : "desc";
    updateQuery({ sort: field === "createdAt" ? undefined : field, order: nextOrder === "desc" ? undefined : nextOrder, page: undefined });
  }

  function toggleItem(id: string, checked: boolean) {
    setExportError("");
    setExportMessage("");
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleCurrentPage(checked: boolean) {
    setExportError("");
    setExportMessage("");
    setSelectedIds(checked ? new Set(currentPageIds) : new Set());
  }

  async function downloadSelected() {
    if (!selectedInVisibleOrder.length || isExporting) return;
    setIsExporting(true);
    setExportError("");
    setExportMessage("");

    try {
      const response = await fetch("/api/feedback/export", {
        body: JSON.stringify({ ids: selectedInVisibleOrder }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        let message = "The selected feedback could not be exported. Please try again.";
        try {
          const body = (await response.json()) as { error?: { message?: string } };
          if (body.error?.message) message = body.error.message;
        } catch {
          // Keep the actionable fallback when the server did not return JSON.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = getExportFilename(response.headers.get("Content-Disposition"));
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      setExportMessage("Your PDF download has started.");
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "The selected feedback could not be exported. Please try again."
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function downloadFiltered() {
    if (!page.total || isExportingFiltered) return;
    setIsExportingFiltered(true);

    try {
      const response = await fetch("/api/feedback/export", {
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message || "The filtered feedback could not be exported.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = getExportFilename(response.headers.get("Content-Disposition"));
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      toast.success(`${page.total} filtered ${page.total === 1 ? "record" : "records"} exported.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The filtered feedback could not be exported.");
    } finally {
      setIsExportingFiltered(false);
    }
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchValue(event.target.value);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Feedback
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Review, filter, and export feedback across every project.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <ProjectSheet
            trigger={
              <Button className="w-full sm:w-auto" type="button" variant="outline">
                <FolderKanban aria-hidden="true" data-icon="inline-start" />
                New project
              </Button>
            }
          />
          <FeedbackSheet
            projects={projects}
            trigger={
              <Button
                className="w-full sm:w-auto"
                disabled={!projects.length}
                title={projects.length ? undefined : "Create a project before adding feedback"}
                type="button"
              >
                <Plus aria-hidden="true" data-icon="inline-start" />
                New feedback
              </Button>
            }
          />
        </div>
      </header>

      <section aria-label="Feedback summary" className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          helper="Across every project"
          icon={MessageSquareText}
          label="Total feedback"
          value={summary.feedbackCount}
        />
        <MetricCard
          helper="Available for feedback"
          icon={FolderKanban}
          label="Projects"
          value={summary.projectCount}
        />
        <MetricCard
          helper="With visual evidence"
          icon={Images}
          label="With photos"
          value={summary.withPhotosCount}
        />
      </section>

      <section
        aria-busy={isNavigating}
        aria-labelledby="feedback-list-heading"
        className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div className="border-b px-4 py-4 sm:px-5 sm:py-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground" id="feedback-list-heading">
                Feedback records
              </h2>
              <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                Showing {firstVisibleResult.toLocaleString()}–{lastVisibleResult.toLocaleString()} of{" "}
                {page.total.toLocaleString()} {page.total === 1 ? "record" : "records"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterCount ? (
                <Badge className="gap-1.5 py-1" variant="secondary">
                  <SlidersHorizontal aria-hidden="true" className="size-3" />
                  {activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}
                </Badge>
              ) : null}
              <Button
                disabled={!page.total || isExportingFiltered}
                onClick={() => void downloadFiltered()}
                size="sm"
                type="button"
                variant="outline"
              >
                {isExportingFiltered ? (
                  <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
                ) : (
                  <FileDown aria-hidden="true" data-icon="inline-start" />
                )}
                {isExportingFiltered ? "Preparing…" : "Download filtered"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
            <div className="relative md:col-span-2 xl:col-span-4">
              <label className="sr-only" htmlFor="feedback-search">
                Search feedback
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="pl-10 pr-10"
                id="feedback-search"
                onChange={handleSearchChange}
                placeholder="Search projects, versions, or feedback…"
                type="search"
                value={searchValue}
              />
              {searchValue ? (
                <button
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
                  onClick={() => setSearchValue("")}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="xl:col-span-2">
              <label className="sr-only" htmlFor="project-filter">
                Filter by project
              </label>
              <Select
                disabled={isNavigating}
                onValueChange={(value) =>
                  updateQuery({
                    project: value === ALL_PROJECTS ? undefined : value,
                    version: undefined,
                    page: undefined
                  })
                }
                value={query.project || ALL_PROJECTS}
              >
                <SelectTrigger id="project-filter">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="xl:col-span-2">
              <label className="sr-only" htmlFor="version-filter">
                Filter by version
              </label>
              <Select
                disabled={isNavigating}
                onValueChange={(value) =>
                  updateQuery({ version: value === ALL_VERSIONS ? undefined : value, page: undefined })
                }
                value={query.version || ALL_VERSIONS}
              >
                <SelectTrigger id="version-filter">
                  <SelectValue placeholder="All versions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL_VERSIONS}>All versions</SelectItem>
                    {versions.map((version) => (
                      <SelectItem key={version} value={version}>
                        {version}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="xl:col-span-2">
              <label className="sr-only" htmlFor="photo-filter">
                Filter by photo attachment
              </label>
              <Select
                disabled={isNavigating}
                onValueChange={(value) =>
                  updateQuery({ hasPhotos: value === "all" ? undefined : value, page: undefined })
                }
                value={query.hasPhotos}
              >
                <SelectTrigger id="photo-filter">
                  <SelectValue placeholder="All photos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All photos</SelectItem>
                    <SelectItem value="yes">With photos</SelectItem>
                    <SelectItem value="no">Without photos</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {activeFilterCount ? (
              <Button
                className="xl:col-span-2"
                onClick={clearFilters}
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" data-icon="inline-start" />
                Clear filters
              </Button>
            ) : (
              <div aria-hidden="true" className="hidden xl:col-span-2 xl:block" />
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_minmax(0,12rem)_auto] xl:justify-end">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground" htmlFor="created-from">
              Created from
              <Input
                className="h-10"
                disabled={isNavigating}
                id="created-from"
                max={query.to || undefined}
                onChange={(event) => updateQuery({ from: event.target.value || undefined, page: undefined })}
                type="date"
                value={query.from}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground" htmlFor="created-to">
              Created to
              <Input
                className="h-10"
                disabled={isNavigating}
                id="created-to"
                min={query.from || undefined}
                onChange={(event) => updateQuery({ to: event.target.value || undefined, page: undefined })}
                type="date"
                value={query.to}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground xl:hidden" htmlFor="mobile-sort">
              Sort by
              <Select
                disabled={isNavigating}
                onValueChange={(value) => updateQuery({ sort: value, page: undefined })}
                value={query.sort}
              >
                <SelectTrigger className="h-10" id="mobile-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="createdAt">Created</SelectItem>
                    <SelectItem value="updatedAt">Updated</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="version">Version</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <Button
              aria-label={`Sort ${query.order === "asc" ? "descending" : "ascending"}`}
              className="mt-auto xl:hidden"
              disabled={isNavigating}
              onClick={() => updateQuery({ order: query.order === "asc" ? undefined : "asc", page: undefined })}
              type="button"
              variant="outline"
            >
              {query.order === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
              {query.order === "asc" ? "Ascending" : "Descending"}
            </Button>
          </div>
        </div>

        {selectedInVisibleOrder.length ? (
          <div className="flex flex-col gap-3 border-b border-primary/20 bg-accent/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {selectedInVisibleOrder.length} {selectedInVisibleOrder.length === 1 ? "record" : "records"} selected
              </p>
              {exportError ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {exportError}
                </p>
              ) : null}
              {exportMessage ? (
                <p className="mt-1 text-sm text-emerald-700" role="status">
                  {exportMessage}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                disabled={isExporting}
                onClick={() => setSelectedIds(new Set())}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear selection
              </Button>
              <DeleteFeedbackDialog
                ids={selectedInVisibleOrder}
                onDeleted={() => setSelectedIds(new Set())}
                trigger={
                  <Button disabled={isExporting} size="sm" type="button" variant="destructive">
                    <Trash2 aria-hidden="true" data-icon="inline-start" />
                    Delete selected
                  </Button>
                }
              />
              <Button disabled={isExporting} onClick={downloadSelected} size="sm" type="button">
                {isExporting ? (
                  <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
                ) : (
                  <FileDown aria-hidden="true" data-icon="inline-start" />
                )}
                {isExporting ? "Preparing PDF…" : "Download selected"}
              </Button>
            </div>
          </div>
        ) : null}

        {!page.items.length ? (
          <EmptyFeedbackState hasFilters={Boolean(activeFilterCount)} onClear={clearFilters} projects={projects} />
        ) : (
          <>
            <div className="hidden min-w-0 xl:block">
              <Table>
                <TableHeader className="bg-muted/45">
                  <TableRow className="hover:bg-muted/45">
                    <TableHead className="w-12 px-3">
                      <span className="inline-flex size-8 items-center justify-center">
                        <Checkbox
                          aria-label="Select all feedback on this page"
                          checked={
                            allCurrentPageSelected
                              ? true
                              : someCurrentPageSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(checked) => toggleCurrentPage(checked === true)}
                        />
                      </span>
                    </TableHead>
                    <SortableHead field="project" label="Project" onSort={sortBy} query={query} />
                    <SortableHead field="version" label="Version" onSort={sortBy} query={query} />
                    <TableHead className="min-w-64">Feedback</TableHead>
                    <TableHead className="w-36">Photos</TableHead>
                    <SortableHead className="w-44" field="createdAt" label="Created" onSort={sortBy} query={query} />
                    <SortableHead className="w-44" field="updatedAt" label="Updated" onSort={sortBy} query={query} />
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.items.map((item) => {
                    const selected = selectedIds.has(item.id);
                    return (
                      <TableRow data-state={selected ? "selected" : undefined} key={item.id}>
                        <TableCell className="px-3">
                          <span className="inline-flex size-8 items-center justify-center">
                            <Checkbox
                              aria-label={`Select feedback for ${item.projectName}, version ${item.projectVersion}`}
                              checked={selected}
                              onCheckedChange={(checked) => toggleItem(item.id, checked === true)}
                            />
                          </span>
                        </TableCell>
                        <TableCell className="max-w-52">
                          <ProjectIdentity name={item.projectName} />
                        </TableCell>
                        <TableCell>
                          <Badge className="font-mono font-medium" variant="secondary">
                            {item.projectVersion}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p
                            className="line-clamp-2 max-w-xl whitespace-pre-line text-sm leading-5 text-foreground"
                            title={item.description}
                          >
                            {item.description}
                          </p>
                        </TableCell>
                        <TableCell>
                          <PhotoPreviewGroup item={item} />
                        </TableCell>
                        <TableCell>
                          <LocalDateTime className="text-xs leading-5 text-muted-foreground" value={item.createdAt} />
                        </TableCell>
                        <TableCell>
                          <LocalDateTime className="text-xs leading-5 text-muted-foreground" value={item.updatedAt} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button asChild size="icon-sm" title="View feedback" variant="ghost">
                              <Link aria-label={`View feedback for ${item.projectName}, version ${item.projectVersion}`} href={`/feedback/${item.id}`}>
                                <Eye aria-hidden="true" />
                              </Link>
                            </Button>
                            <Button asChild size="icon-sm" title="Download PDF" variant="ghost">
                              <a
                                aria-label={`Download PDF for ${item.projectName}, version ${item.projectVersion}`}
                                download
                                href={`/api/feedback/${item.id}/export`}
                              >
                                <Download aria-hidden="true" />
                              </a>
                            </Button>
                            <DeleteFeedbackDialog
                              ids={[item.id]}
                              trigger={
                                <Button
                                  aria-label={`Delete feedback for ${item.projectName}, version ${item.projectVersion}`}
                                  size="icon-sm"
                                  title="Delete feedback"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Trash2 aria-hidden="true" />
                                </Button>
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y xl:hidden">
              <div className="flex min-h-12 items-center justify-between gap-3 bg-muted/40 px-4 py-2.5 sm:px-5">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
                  <Checkbox
                    checked={
                      allCurrentPageSelected
                        ? true
                        : someCurrentPageSelected
                          ? "indeterminate"
                          : false
                    }
                    className="size-5"
                    onCheckedChange={(checked) => toggleCurrentPage(checked === true)}
                  />
                  Select this page
                </label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {page.items.length} {page.items.length === 1 ? "item" : "items"}
                </span>
              </div>
              {page.items.map((item) => {
                const selected = selectedIds.has(item.id);
                return (
                  <article
                    className={cn(
                      "p-4 transition-colors sm:p-5 [content-visibility:auto]",
                      selected ? "bg-accent/55" : "bg-card"
                    )}
                    key={item.id}
                  >
                    <div className="flex items-start gap-3">
                      <label className="-ml-2 -mt-2 grid size-11 shrink-0 cursor-pointer place-items-center">
                        <Checkbox
                          aria-label={`Select feedback for ${item.projectName}, version ${item.projectVersion}`}
                          checked={selected}
                          className="size-5"
                          onCheckedChange={(checked) => toggleItem(item.id, checked === true)}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <ProjectIdentity name={item.projectName} />
                          <Badge className="font-mono font-medium" variant="secondary">
                            {item.projectVersion}
                          </Badge>
                        </div>
                        <p className="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-6 text-foreground">
                          {item.description}
                        </p>
                        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t pt-4">
                          <PhotoPreviewGroup item={item} large />
                          <div className="text-right text-xs leading-5 text-muted-foreground">
                            <p>Created</p>
                            <LocalDateTime value={item.createdAt} />
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/feedback/${item.id}`}>
                              <Eye aria-hidden="true" data-icon="inline-start" />
                              View
                            </Link>
                          </Button>
                          <DeleteFeedbackDialog
                            ids={[item.id]}
                            trigger={
                              <Button className="col-span-2" size="sm" type="button" variant="outline">
                                <Trash2 aria-hidden="true" data-icon="inline-start" />
                                Delete
                              </Button>
                            }
                          />
                          <Button asChild size="sm" variant="outline">
                            <a download href={`/api/feedback/${item.id}/export`}>
                              <Download aria-hidden="true" data-icon="inline-start" />
                              PDF
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <div className="flex flex-col gap-4 border-t bg-muted/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page</span>
            <Select
              disabled={isNavigating}
              onValueChange={(value) => updateQuery({ pageSize: value === "25" ? undefined : value, page: undefined })}
              value={String(page.pageSize)}
            >
              <SelectTrigger aria-label="Rows per page" className="h-9 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <nav aria-label="Feedback pagination" className="flex items-center justify-between gap-2 sm:justify-end">
            <Button
              aria-label="Previous page"
              disabled={page.page <= 1 || isNavigating}
              onClick={() => updateQuery({ page: page.page - 1 === 1 ? undefined : page.page - 1 })}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <div className="hidden items-center gap-1 min-[400px]:flex">
              {visiblePages.map((pageNumber) => (
                <Button
                  aria-current={pageNumber === page.page ? "page" : undefined}
                  aria-label={`Page ${pageNumber}`}
                  key={pageNumber}
                  onClick={() => updateQuery({ page: pageNumber === 1 ? undefined : pageNumber })}
                  size="icon-sm"
                  type="button"
                  variant={pageNumber === page.page ? "default" : "ghost"}
                >
                  {pageNumber}
                </Button>
              ))}
            </div>
            <span className="text-sm tabular-nums text-muted-foreground min-[400px]:hidden">
              {page.page} / {Math.max(page.pageCount, 1)}
            </span>
            <Button
              aria-label="Next page"
              disabled={page.page >= page.pageCount || isNavigating}
              onClick={() => updateQuery({ page: page.page + 1 })}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </nav>
        </div>
      </section>
    </div>
  );
}
