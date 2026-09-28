"use client";

import { Clock3, Pin, PinOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  rememberProject,
  parseProjectsSnapshot,
  subscribeToProjects,
  projectsSnapshot,
  sortProjects,
  writeProjects,
  readProjects,
} from "../client/recent-project-storage";

export function ProjectAccessTracker({
  project,
}: {
  project: { id: string; name: string };
}) {
  useEffect(() => {
    rememberProject(project);
  }, [project]);

  return null;
}

export function RecentProjects({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const snapshot = useSyncExternalStore(
    subscribeToProjects,
    projectsSnapshot,
    () => "[]",
  );
  const projects = useMemo(
    () => sortProjects(parseProjectsSnapshot(snapshot)),
    [snapshot],
  );

  function togglePin(projectId: string) {
    writeProjects(
      readProjects().map((project) =>
        project.id === projectId
          ? { ...project, pinned: !project.pinned }
          : project,
      ),
    );
  }

  if (!projects.length) return null;

  return (
    <section
      aria-labelledby="recent-projects-title"
      className={cn("flex min-h-0 flex-col gap-2", className)}
    >
      <div className="flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock3 aria-hidden="true" className="size-3.5" />
        <h2 id="recent-projects-title">Recent projects</h2>
      </div>
      <div className="scrollbar-subtle flex min-h-0 flex-col gap-1 overflow-y-auto">
        {projects.slice(0, 6).map((project) => (
          <div
            className="group flex min-w-0 items-center gap-1 rounded-md hover:bg-accent"
            key={project.id}
          >
            <Link
              className="min-w-0 flex-1 truncate px-2 py-2 text-sm text-muted-foreground transition-colors group-hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={`/projects/${project.id}`}
              onClick={onNavigate}
              prefetch={false}
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
              {project.pinned ? (
                <PinOff aria-hidden="true" />
              ) : (
                <Pin aria-hidden="true" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
