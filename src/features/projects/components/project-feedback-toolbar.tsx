"use client"

import { ArrowDown, ArrowUp, FileDown, Loader2, Search, SlidersHorizontal, X } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { type ChangeEvent, useCallback, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FeedbackQuery } from "@/entities/contracts/feedback"

const ALL_VERSIONS = "__all_versions"

function exportFilename(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? "feedy-feedback-export.pdf"
}

export function ProjectFeedbackToolbar({
  query,
  versions,
  total,
}: {
  query: FeedbackQuery
  versions: string[]
  total: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isNavigating, startNavigation] = useTransition()
  const [searchValue, setSearchValue] = useState(query.q)
  const [isExporting, setIsExporting] = useState(false)

  const updateQuery = useCallback(
    (patch: Partial<Record<keyof FeedbackQuery, string | number | undefined>>, mode: "push" | "replace" = "push") => {
      const params = new URLSearchParams(window.location.search)
      params.delete("project")
      params.delete("pageSize")

      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") params.delete(key)
        else params.set(key, String(value))
      }

      const destination = params.size ? `${pathname}?${params.toString()}` : pathname
      startNavigation(() => {
        if (mode === "replace") router.replace(destination, { scroll: false })
        else router.push(destination, { scroll: false })
      })
    },
    [pathname, router]
  )

  useEffect(() => {
    if (searchValue === query.q) return
    const timeout = window.setTimeout(() => {
      updateQuery({ q: searchValue.trim() || undefined, page: undefined }, "replace")
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [query.q, searchValue, updateQuery])

  const activeFilterCount = [
    Boolean(query.q),
    Boolean(query.version),
    query.hasPhotos !== "all",
    Boolean(query.from),
    Boolean(query.to),
  ].filter(Boolean).length

  async function downloadFiltered() {
    if (!total || isExporting) return
    setIsExporting(true)

    try {
      const response = await fetch("/api/feedback/export", {
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(body?.error?.message || "The filtered project feedback could not be exported.")
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = exportFilename(response.headers.get("Content-Disposition"))
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
      toast.success(`${total} filtered ${total === 1 ? "record" : "records"} exported.`)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The filtered project feedback could not be exported.")
    } finally {
      setIsExporting(false)
    }
  }

  function clearFilters() {
    setSearchValue("")
    startNavigation(() => router.push(pathname, { scroll: false }))
  }

  function handleSearch(event: ChangeEvent<HTMLInputElement>) {
    setSearchValue(event.target.value)
  }

  return (
    <div aria-busy={isNavigating} className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">Filter project feedback</p>
          {activeFilterCount ? (
            <Badge className="gap-1.5" variant="secondary">
              <SlidersHorizontal aria-hidden="true" className="size-3" />
              {activeFilterCount} active
            </Badge>
          ) : null}
        </div>
        <Button
          disabled={!total || isExporting}
          onClick={() => void downloadFiltered()}
          size="sm"
          type="button"
          variant="outline"
        >
          {isExporting ? (
            <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
          ) : (
            <FileDown aria-hidden="true" data-icon="inline-start" />
          )}
          {isExporting ? "Preparing PDF…" : `Download filtered (${total})`}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        <div className="relative md:col-span-2 xl:col-span-4">
          <label className="sr-only" htmlFor="project-feedback-search">Search project feedback</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10 pr-10"
            id="project-feedback-search"
            onChange={handleSearch}
            placeholder="Search versions or feedback…"
            type="search"
            value={searchValue}
          />
          {searchValue ? (
            <button
              aria-label="Clear project feedback search"
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
              onClick={() => setSearchValue("")}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="xl:col-span-2">
          <label className="sr-only" htmlFor="project-version-filter">Filter by version</label>
          <Select
            disabled={isNavigating}
            onValueChange={(value) => updateQuery({ version: value === ALL_VERSIONS ? undefined : value, page: undefined })}
            value={query.version || ALL_VERSIONS}
          >
            <SelectTrigger id="project-version-filter"><SelectValue placeholder="All versions" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_VERSIONS}>All versions</SelectItem>
                {versions.map((version) => <SelectItem key={version} value={version}>{version}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="xl:col-span-2">
          <label className="sr-only" htmlFor="project-photo-filter">Filter by photo attachment</label>
          <Select
            disabled={isNavigating}
            onValueChange={(value) => updateQuery({ hasPhotos: value === "all" ? undefined : value, page: undefined })}
            value={query.hasPhotos}
          >
            <SelectTrigger id="project-photo-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All photos</SelectItem>
                <SelectItem value="yes">With photos</SelectItem>
                <SelectItem value="no">Without photos</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground xl:col-span-2" htmlFor="project-created-from">
          Created from
          <Input
            className="h-10"
            disabled={isNavigating}
            id="project-created-from"
            max={query.to || undefined}
            onChange={(event) => updateQuery({ from: event.target.value || undefined, page: undefined })}
            type="date"
            value={query.from}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground xl:col-span-2" htmlFor="project-created-to">
          Created to
          <Input
            className="h-10"
            disabled={isNavigating}
            id="project-created-to"
            min={query.from || undefined}
            onChange={(event) => updateQuery({ to: event.target.value || undefined, page: undefined })}
            type="date"
            value={query.to}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
        <label className="flex min-w-48 flex-col gap-1.5 text-xs font-medium text-muted-foreground" htmlFor="project-feedback-sort">
          Sort by
          <Select disabled={isNavigating} onValueChange={(value) => updateQuery({ sort: value === "createdAt" ? undefined : value, page: undefined })} value={query.sort}>
            <SelectTrigger className="h-10" id="project-feedback-sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="createdAt">Created</SelectItem>
                <SelectItem value="updatedAt">Updated</SelectItem>
                <SelectItem value="version">Version</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
        <Button
          disabled={isNavigating}
          onClick={() => updateQuery({ order: query.order === "asc" ? undefined : "asc", page: undefined })}
          type="button"
          variant="outline"
        >
          {query.order === "asc" ? <ArrowUp aria-hidden="true" data-icon="inline-start" /> : <ArrowDown aria-hidden="true" data-icon="inline-start" />}
          {query.order === "asc" ? "Ascending" : "Descending"}
        </Button>
        {activeFilterCount ? (
          <Button onClick={clearFilters} type="button" variant="ghost">
            <X aria-hidden="true" data-icon="inline-start" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  )
}
