"use client"

import { Clock3, Pin, PinOff } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "feedy:recent-projects:v1"
const CHANGE_EVENT = "feedy:recent-projects-changed"
const MAX_PROJECTS = 8

type RecentProject = {
  id: string
  name: string
  accessedAt: string
  pinned: boolean
}

function isRecentProject(value: unknown): value is RecentProject {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<RecentProject>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.accessedAt === "string" &&
    typeof candidate.pinned === "boolean"
  )
}

function readProjects() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown
    return Array.isArray(parsed) ? parsed.filter(isRecentProject) : []
  } catch {
    return []
  }
}

function parseProjectsSnapshot(snapshot: string) {
  try {
    const parsed = JSON.parse(snapshot) as unknown
    return Array.isArray(parsed) ? parsed.filter(isRecentProject) : []
  } catch {
    return []
  }
}

function subscribeToProjects(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function projectsSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? "[]"
}

function sortProjects(projects: RecentProject[]) {
  return projects.toSorted((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
    return Date.parse(right.accessedAt) - Date.parse(left.accessedAt)
  })
}

function writeProjects(projects: RecentProject[]) {
  const sorted = sortProjects(projects)
  const pinned = sorted.filter((project) => project.pinned)
  const recent = sorted.filter((project) => !project.pinned).slice(0, MAX_PROJECTS)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...pinned, ...recent]))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function rememberProject(project: { id: string; name: string }) {
  const current = readProjects()
  const existing = current.find((item) => item.id === project.id)
  writeProjects([
    ...current.filter((item) => item.id !== project.id),
    {
      id: project.id,
      name: project.name,
      accessedAt: new Date().toISOString(),
      pinned: existing?.pinned ?? false,
    },
  ])
}

export function forgetProject(projectId: string) {
  writeProjects(readProjects().filter((project) => project.id !== projectId))
}

export function ProjectAccessTracker({ project }: { project: { id: string; name: string } }) {
  useEffect(() => {
    rememberProject(project)
  }, [project])

  return null
}

export function RecentProjects({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const snapshot = useSyncExternalStore(subscribeToProjects, projectsSnapshot, () => "[]")
  const projects = useMemo(() => sortProjects(parseProjectsSnapshot(snapshot)), [snapshot])

  function togglePin(projectId: string) {
    writeProjects(
      readProjects().map((project) =>
        project.id === projectId ? { ...project, pinned: !project.pinned } : project
      )
    )
  }

  if (!projects.length) return null

  return (
    <section aria-labelledby="recent-projects-title" className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock3 aria-hidden="true" className="size-3.5" />
        <h2 id="recent-projects-title">Recent projects</h2>
      </div>
      <div className="scrollbar-subtle flex min-h-0 flex-col gap-1 overflow-y-auto">
        {projects.slice(0, 6).map((project) => (
          <div className="group flex min-w-0 items-center gap-1 rounded-md hover:bg-accent" key={project.id}>
            <Link
              className="min-w-0 flex-1 truncate px-2 py-2 text-sm text-muted-foreground transition-colors group-hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={`/projects/${project.id}`}
              onClick={onNavigate}
              title={project.name}
            >
              {project.name}
            </Link>
            <Button
              aria-label={`${project.pinned ? "Unpin" : "Pin"} ${project.name}`}
              aria-pressed={project.pinned}
              className="mr-1 shrink-0"
              onClick={() => togglePin(project.id)}
              size="icon-sm"
              title={project.pinned ? "Unpin project" : "Pin project"}
              type="button"
              variant="ghost"
            >
              {project.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
