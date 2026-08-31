import { ArrowLeft, CalendarDays, Download, Images, Layers3, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-date-time";
import { getFeedbackById } from "@/data-access/feedback/feedback-repository";
import { DeleteFeedbackDialog } from "@/features/feedback/components/delete-feedback-dialog";
import { feedbackIdSchema } from "@/lib/validation/feedback";

export const dynamic = "force-dynamic";

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!feedbackIdSchema.safeParse(id).success) notFound();
  const feedback = await getFeedbackById(id);
  if (!feedback) notFound();

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-3xl flex-col gap-3">
          <Button asChild className="w-fit" size="sm" variant="ghost">
            <Link href="/" prefetch={false}>
              <ArrowLeft aria-hidden="true" data-icon="inline-start" />
              Back to feedback
            </Link>
          </Button>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {feedback.projectName}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Feedback for version {feedback.projectVersion}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <DeleteFeedbackDialog
            ids={[feedback.id]}
            redirectTo={`/?project=${feedback.projectId}`}
            trigger={
              <Button type="button" variant="outline">
                <Trash2 aria-hidden="true" data-icon="inline-start" />
                Delete feedback
              </Button>
            }
          />
          <Button asChild>
            <a href={`/api/feedback/${feedback.id}/export`}>
              <Download aria-hidden="true" data-icon="inline-start" />
              Download PDF
            </a>
          </Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader>
            <CardTitle>Feedback description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-[0.95rem] leading-7 text-foreground">
              {feedback.description}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Record details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 text-sm">
            <div className="flex items-start gap-3 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
              <Layers3 aria-hidden="true" className="text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Project version</span>
                <span className="font-medium">{feedback.projectVersion}</span>
              </div>
            </div>
            <div className="flex items-start gap-3 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
              <CalendarDays aria-hidden="true" className="text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Created</span>
                <LocalDateTime className="font-medium" value={feedback.createdAt} />
              </div>
            </div>
            <div className="flex items-start gap-3 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
              <Images aria-hidden="true" className="text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Photos</span>
                <span className="font-medium">{feedback.photoCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="photos-title">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight" id="photos-title">Photos</h2>
          <span className="text-sm text-muted-foreground">{feedback.photoCount} attached</span>
        </div>
        {feedback.photos.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {feedback.photos.map((photo, index) => (
              <figure className="overflow-hidden rounded-xl border bg-card shadow-sm" key={photo.id}>
                <div className="relative aspect-[4/3] bg-muted">
                  <Image
                    alt={`${feedback.projectName} feedback photo ${index + 1}`}
                    className="object-contain"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    src={photo.url}
                    unoptimized
                  />
                </div>
                <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
                  {photo.originalFilename}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            No photos attached to this feedback.
          </div>
        )}
      </section>
    </div>
  );
}
