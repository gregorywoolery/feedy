import { FolderKanban, MessageSquarePlus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LocalDateTime } from "@/components/local-date-time";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { listProjectOptions, listProjects } from "@/data-access/projects/project-repository";
import { FeedbackSheet } from "@/features/feedback/components/feedback-sheet";
import { ProjectSheet } from "@/features/projects/components/project-sheet";
import { DeleteProjectDialog } from "@/features/projects/components/delete-project-dialog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const [projects, options] = await Promise.all([listProjects(), listProjectOptions()]);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Keep every observation, version, and photo grouped by the work it belongs to.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {options.length ? (
            <FeedbackSheet
              projects={options}
              trigger={
                <Button variant="outline">
                  <MessageSquarePlus aria-hidden="true" data-icon="inline-start" />
                  Add feedback
                </Button>
              }
            />
          ) : null}
          <ProjectSheet
            trigger={
              <Button>
                <Plus aria-hidden="true" data-icon="inline-start" />
                New project
              </Button>
            }
          />
        </div>
      </header>

      {projects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card className="flex min-h-60 flex-col" key={project.id}>
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription className="line-clamp-3 leading-6">
                  {project.description || "No project description yet."}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Feedback</span>
                  <span className="font-semibold tabular-nums">{project.feedbackCount}</span>
                </div>
                <div className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Last activity</span>
                  <span className="text-right font-medium">
                    {project.lastActivityAt ? <LocalDateTime value={project.lastActivityAt} /> : "No activity"}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="gap-2 border-t pt-4">
                <Button asChild className="flex-1" variant="outline">
                  <Link href={`/projects/${project.id}`} prefetch={false}>Open project</Link>
                </Button>
                <FeedbackSheet
                  defaultProjectId={project.id}
                  projects={options}
                  trigger={
                    <Button aria-label={`Add feedback to ${project.name}`} size="icon" variant="ghost">
                      <MessageSquarePlus aria-hidden="true" />
                    </Button>
                  }
                />
                <DeleteProjectDialog
                  feedbackCount={project.feedbackCount}
                  projectId={project.id}
                  projectName={project.name}
                  trigger={
                    <Button aria-label={`Delete ${project.name}`} size="icon" type="button" variant="ghost">
                      <Trash2 aria-hidden="true" />
                    </Button>
                  }
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="min-h-[28rem] border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanban aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Create your first project</EmptyTitle>
            <EmptyDescription>
              Feedback always belongs to a project. Start by naming the work you want to review.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <ProjectSheet
              trigger={
                <Button>
                  <Plus aria-hidden="true" data-icon="inline-start" />
                  New project
                </Button>
              }
            />
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
