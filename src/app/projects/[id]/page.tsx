import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Images,
  MessageSquarePlus,
  Pencil,
  Trash2
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-date-time";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { listFeedback, listFeedbackVersions } from "@/data-access/feedback/feedback-repository";
import {
  getProjectById,
  listProjectOptions
} from "@/data-access/projects/project-repository";
import type { FeedbackListItem, FeedbackQuery } from "@/entities/contracts/feedback";
import { ProjectAccessTracker } from "@/features/app-shell/components/recent-projects";
import { DeleteFeedbackDialog } from "@/features/feedback/components/delete-feedback-dialog";
import { EditFeedbackSheet } from "@/features/feedback/components/edit-feedback-sheet";
import { FeedbackSheet } from "@/features/feedback/components/feedback-sheet";
import { DeleteProjectDialog } from "@/features/projects/components/delete-project-dialog";
import { ProjectFeedbackToolbar } from "@/features/projects/components/project-feedback-toolbar";
import { feedbackIdSchema, parseFeedbackQuery } from "@/lib/validation/feedback";

export const dynamic = "force-dynamic";

function projectPageHref(projectId: string, query: FeedbackQuery, page: number) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.version) params.set("version", query.version);
  if (query.hasPhotos !== "all") params.set("hasPhotos", query.hasPhotos);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.sort !== "createdAt") params.set("sort", query.sort);
  if (query.order !== "desc") params.set("order", query.order);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/projects/${projectId}?${suffix}` : `/projects/${projectId}`;
}

function PhotoPreviews({ item, large = false }: { item: FeedbackListItem; large?: boolean }) {
  if (!item.photoCount) {
    return <span className="text-sm text-muted-foreground">No photos</span>;
  }

  const photos = item.photos.slice(0, large ? 4 : 3);
  const hiddenCount = item.photoCount - photos.length;

  return (
    <div
      aria-label={`${item.photoCount} attached ${item.photoCount === 1 ? "photo" : "photos"}`}
      className="flex items-center"
    >
      <div className="flex [&>*+*]:-ml-2">
        {photos.map((photo, index) => (
          <span
            className={`relative block shrink-0 overflow-hidden rounded-md border-2 border-card bg-muted shadow-sm ${
              large ? "size-12" : "size-9"
            }`}
            key={photo.id}
            style={{ zIndex: photos.length - index }}
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
      {hiddenCount > 0 ? (
        <span className="ml-2 text-xs font-medium tabular-nums text-muted-foreground">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function FeedbackActions({ item, compact = false }: { item: FeedbackListItem; compact?: boolean }) {
  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2 border-t pt-4">
        <Button asChild variant="outline">
          <Link href={`/feedback/${item.id}`} prefetch={false}>
            <Eye aria-hidden="true" data-icon="inline-start" />
            View
          </Link>
        </Button>
        <EditFeedbackSheet feedback={item} trigger={<Button type="button" variant="outline"><Pencil aria-hidden="true" data-icon="inline-start" />Edit</Button>} />
        <Button asChild variant="outline">
          <a href={`/api/feedback/${item.id}/export`}>
            <Download aria-hidden="true" data-icon="inline-start" />
            PDF
          </a>
        </Button>
        <DeleteFeedbackDialog
          ids={[item.id]}
          trigger={
            <Button className="col-span-2" type="button" variant="outline">
              <Trash2 aria-hidden="true" data-icon="inline-start" />
              Delete
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      <Button asChild size="icon-sm" variant="ghost">
        <Link aria-label={`View feedback for version ${item.projectVersion}`} href={`/feedback/${item.id}`} prefetch={false}>
          <Eye aria-hidden="true" />
        </Link>
      </Button>
      <EditFeedbackSheet feedback={item} trigger={<Button aria-label={`Edit feedback for version ${item.projectVersion}`} size="icon-sm" title="Edit feedback" type="button" variant="ghost"><Pencil aria-hidden="true" /></Button>} />
      <DeleteFeedbackDialog
        ids={[item.id]}
        trigger={
          <Button
            aria-label={`Delete feedback for version ${item.projectVersion}`}
            size="icon-sm"
            title="Delete feedback"
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        }
      />
      <Button asChild size="icon-sm" variant="ghost">
        <a
          aria-label={`Download PDF for version ${item.projectVersion}`}
          href={`/api/feedback/${item.id}/export`}
        >
          <Download aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  if (!feedbackIdSchema.safeParse(id).success) notFound();

  const parsedQuery = parseFeedbackQuery(resolvedSearchParams);
  const query: FeedbackQuery = { ...parsedQuery, project: id, pageSize: 25 };
  const [project, feedbackPage, projectOptions, versions] = await Promise.all([
    getProjectById(id),
    listFeedback(query),
    listProjectOptions(),
    listFeedbackVersions(id)
  ]);
  if (!project) notFound();

  const firstItem = feedbackPage.total
    ? (feedbackPage.page - 1) * feedbackPage.pageSize + 1
    : 0;
  const lastItem = Math.min(feedbackPage.page * feedbackPage.pageSize, feedbackPage.total);

  return (
    <div className="flex flex-col gap-7">
      <ProjectAccessTracker project={{ id: project.id, name: project.name }} />
      <header className="flex flex-col gap-5">
        <Button asChild className="-ml-3 w-fit" size="sm" variant="ghost">
          <Link href="/projects" prefetch={false}>
            <ArrowLeft aria-hidden="true" data-icon="inline-start" />
            Back to projects
          </Link>
        </Button>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 max-w-3xl flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight text-foreground">
                {project.name}
              </h1>
              <Badge className="shrink-0 tabular-nums" variant="secondary">
                {project.feedbackCount} {project.feedbackCount === 1 ? "item" : "items"}
              </Badge>
            </div>
            <p className="max-w-2xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {project.description || "No project description yet."}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="size-4" />
                {project.lastActivityAt ? (
                  <LocalDateTime prefix="Last activity " value={project.lastActivityAt} />
                ) : (
                  "No feedback activity yet"
                )}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <DeleteProjectDialog
              feedbackCount={project.feedbackCount}
              projectId={project.id}
              projectName={project.name}
              trigger={
                <Button className="w-full sm:w-auto" type="button" variant="outline">
                  <Trash2 aria-hidden="true" data-icon="inline-start" />
                  Delete project
                </Button>
              }
            />
            <FeedbackSheet
              defaultProjectId={project.id}
              projects={projectOptions}
              trigger={
                <Button className="w-full sm:w-auto">
                  <MessageSquarePlus aria-hidden="true" data-icon="inline-start" />
                  Add feedback
                </Button>
              }
            />
          </div>
        </div>
      </header>

      <section aria-labelledby="project-feedback-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight" id="project-feedback-title">
              Feedback
            </h2>
            <p className="text-sm text-muted-foreground">
              Versions, observations, and evidence captured for this project.
            </p>
          </div>
          {project.feedbackCount ? (
            <Button asChild className="w-fit" size="sm" variant="outline">
              <Link href={`/?project=${project.id}`} prefetch={false}>Open in all feedback</Link>
            </Button>
          ) : null}
        </div>

        {project.feedbackCount ? (
          <ProjectFeedbackToolbar query={query} total={feedbackPage.total} versions={versions} />
        ) : null}

        {feedbackPage.items.length ? (
          <>
            <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[10rem]">Version</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead className="w-[10rem]">Photos</TableHead>
                    <TableHead className="w-[13rem]">Created</TableHead>
                    <TableHead className="w-[8.5rem] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbackPage.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.projectVersion}</TableCell>
                      <TableCell>
                        <p
                          className="line-clamp-2 max-w-2xl whitespace-pre-wrap leading-6 text-foreground"
                          title={item.description}
                        >
                          {item.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        <PhotoPreviews item={item} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <LocalDateTime value={item.createdAt} />
                      </TableCell>
                      <TableCell>
                        <FeedbackActions item={item} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 md:hidden">
              {feedbackPage.items.map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex flex-col gap-5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Version
                        </p>
                        <p className="mt-1 break-words font-semibold text-foreground">
                          {item.projectVersion}
                        </p>
                      </div>
                      <PhotoPreviews item={item} large />
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays aria-hidden="true" className="size-3.5" />
                      <LocalDateTime value={item.createdAt} />
                    </div>
                    <FeedbackActions compact item={item} />
                  </CardContent>
                </Card>
              ))}
            </div>

            {feedbackPage.pageCount > 1 ? (
              <nav
                aria-label="Project feedback pagination"
                className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-muted-foreground">
                  Showing {firstItem}–{lastItem} of {feedbackPage.total}
                </p>
                <div className="flex gap-2">
                  {feedbackPage.page > 1 ? (
                    <Button asChild className="flex-1 sm:flex-none" size="sm" variant="outline">
                      <Link href={projectPageHref(project.id, query, feedbackPage.page - 1)} prefetch={false}>
                        <ChevronLeft aria-hidden="true" data-icon="inline-start" />
                        Previous
                      </Link>
                    </Button>
                  ) : (
                    <Button className="flex-1 sm:flex-none" disabled size="sm" variant="outline">
                      <ChevronLeft aria-hidden="true" data-icon="inline-start" />
                      Previous
                    </Button>
                  )}
                  {feedbackPage.page < feedbackPage.pageCount ? (
                    <Button asChild className="flex-1 sm:flex-none" size="sm" variant="outline">
                      <Link href={projectPageHref(project.id, query, feedbackPage.page + 1)} prefetch={false}>
                        Next
                        <ChevronRight aria-hidden="true" data-icon="inline-end" />
                      </Link>
                    </Button>
                  ) : (
                    <Button className="flex-1 sm:flex-none" disabled size="sm" variant="outline">
                      Next
                      <ChevronRight aria-hidden="true" data-icon="inline-end" />
                    </Button>
                  )}
                </div>
              </nav>
            ) : null}
          </>
        ) : (
          <Empty className="min-h-80 border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Images aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{project.feedbackCount ? "No matching feedback" : "No feedback yet"}</EmptyTitle>
              <EmptyDescription>
                {project.feedbackCount
                  ? "Try a broader search or clear the active filters."
                  : "Add the first observation for this project, including its version and any supporting photos."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {project.feedbackCount ? (
                <Button asChild variant="outline">
                  <Link href={`/projects/${project.id}`} prefetch={false}>Clear filters</Link>
                </Button>
              ) : (
                <FeedbackSheet
                  defaultProjectId={project.id}
                  projects={projectOptions}
                  trigger={
                    <Button>
                      <MessageSquarePlus aria-hidden="true" data-icon="inline-start" />
                      Add feedback
                    </Button>
                  }
                />
              )}
            </EmptyContent>
          </Empty>
        )}
      </section>
    </div>
  );
}
