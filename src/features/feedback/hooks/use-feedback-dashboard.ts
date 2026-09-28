"use client";

import type {
  FeedbackPage,
  FeedbackQuery,
  FeedbackSort,
  SortOrder,
} from "@/entities/contracts/feedback";
import { usePathname, useRouter } from "next/navigation";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { downloadFeedback } from "../client/download-feedback";

type QueryPatch = Partial<
  Record<keyof FeedbackQuery, string | number | undefined>
>;

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

function getVisiblePages(currentPage: number, pageCount: number) {
  if (pageCount <= 5)
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  const start = Math.min(Math.max(currentPage - 2, 1), pageCount - 4);
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export function useFeedbackDashboard(page: FeedbackPage, query: FeedbackQuery) {
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

      const destination = params.size
        ? `${pathname}?${params.toString()}`
        : pathname;
      startNavigation(() => {
        if (mode === "replace") router.replace(destination, { scroll: false });
        else router.push(destination, { scroll: false });
      });
    },
    [pathname, query, router],
  );

  useEffect(() => {
    if (searchValue === query.q) return;
    const timeout = window.setTimeout(() => {
      updateQuery(
        { q: searchValue.trim() || undefined, page: undefined },
        "replace",
      );
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [query.q, searchValue, updateQuery]);

  const activeFilterCount = [
    Boolean(query.q),
    Boolean(query.project),
    Boolean(query.version),
    query.hasPhotos !== "all",
    Boolean(query.from),
    Boolean(query.to),
  ].filter(Boolean).length;

  const currentPageIds = useMemo(
    () => page.items.map((item) => item.id),
    [page.items],
  );
  const selectedInVisibleOrder = useMemo(
    () => currentPageIds.filter((id) => selectedIds.has(id)),
    [currentPageIds, selectedIds],
  );
  const allCurrentPageSelected =
    currentPageIds.length > 0 &&
    selectedInVisibleOrder.length === currentPageIds.length;
  const someCurrentPageSelected =
    selectedInVisibleOrder.length > 0 && !allCurrentPageSelected;

  const visiblePages = getVisiblePages(page.page, page.pageCount);
  const firstVisibleResult = page.total
    ? (page.page - 1) * page.pageSize + 1
    : 0;
  const lastVisibleResult = Math.min(page.page * page.pageSize, page.total);

  function clearFilters() {
    setSearchValue("");
    startNavigation(() => router.push(pathname, { scroll: false }));
  }

  function sortBy(field: FeedbackSort) {
    const nextOrder: SortOrder =
      query.sort === field && query.order === "desc" ? "asc" : "desc";
    updateQuery({
      sort: field === "createdAt" ? undefined : field,
      order: nextOrder === "desc" ? undefined : nextOrder,
      page: undefined,
    });
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
      await downloadFeedback({ ids: selectedInVisibleOrder });
      setExportMessage("Your PDF download has started.");
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "The selected feedback could not be exported. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function downloadFiltered() {
    if (!page.total || isExportingFiltered) return;
    setIsExportingFiltered(true);

    try {
      await downloadFeedback({ query });
      toast.success(
        `${page.total} filtered ${page.total === 1 ? "record" : "records"} exported.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The filtered feedback could not be exported.",
      );
    } finally {
      setIsExportingFiltered(false);
    }
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchValue(event.target.value);
  }

  return {
    isNavigating,
    searchValue,
    setSearchValue,
    selectedIds,
    setSelectedIds,
    isExporting,
    isExportingFiltered,
    exportMessage,
    exportError,
    updateQuery,
    activeFilterCount,
    selectedInVisibleOrder,
    allCurrentPageSelected,
    someCurrentPageSelected,
    visiblePages,
    firstVisibleResult,
    lastVisibleResult,
    clearFilters,
    sortBy,
    toggleItem,
    toggleCurrentPage,
    downloadSelected,
    downloadFiltered,
    handleSearchChange,
  };
}
