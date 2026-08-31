"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel
} from "@/components/ui/field";
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
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ApiErrorBody } from "@/entities/contracts/api";
import type { FeedbackDetailRecord } from "@/entities/contracts/feedback";
import type { ProjectOption } from "@/entities/contracts/project";
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_COUNT,
  MAX_TOTAL_PHOTO_BYTES
} from "@/lib/validation/photo-limits";

type Stage = "form" | "review" | "success";
type PhotoPreview = { id: string; file: File; url: string };

export function FeedbackSheet({
  trigger,
  projects,
  defaultProjectId = ""
}: {
  trigger: ReactNode;
  projects: ProjectOption[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const versionRef = useRef<HTMLInputElement>(null);
  const photoUrls = useRef(new Set<string>());
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [projectVersion, setProjectVersion] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<FeedbackDetailRecord | null>(null);

  useEffect(() => {
    const urls = photoUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (open && stage === "form" && projectId) {
      window.setTimeout(() => versionRef.current?.focus(), 30);
    }
  }, [open, projectId, stage]);

  function clearPhotos() {
    photoUrls.current.forEach((url) => URL.revokeObjectURL(url));
    photoUrls.current.clear();
    setPhotos([]);
  }

  function reset() {
    setStage("form");
    setProjectId(defaultProjectId);
    setProjectVersion("");
    setDescription("");
    clearPhotos();
    setErrors({});
    setMessage("");
    setCreated(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return;
    setOpen(nextOpen);
    if (!nextOpen) window.setTimeout(reset, 220);
  }

  function addPhotos(files: File[]) {
    const nextErrors: Record<string, string[]> = {};
    const combined = [...photos.map((item) => item.file), ...files];
    if (combined.length > MAX_PHOTO_COUNT) {
      nextErrors.photos = [`Add no more than ${MAX_PHOTO_COUNT} photos.`];
    } else if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      nextErrors.photos = ["Choose JPEG, PNG, or WebP images only."];
    } else if (files.some((file) => file.size > MAX_PHOTO_BYTES)) {
      nextErrors.photos = ["Each photo must be 10 MB or less."];
    } else if (combined.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_PHOTO_BYTES) {
      nextErrors.photos = ["Photos must be 50 MB or less in total."];
    }
    if (nextErrors.photos) {
      setErrors((current) => ({ ...current, ...nextErrors }));
      return;
    }

    const additions = files.map((file) => {
      const url = URL.createObjectURL(file);
      photoUrls.current.add(url);
      return { id: crypto.randomUUID(), file, url };
    });
    setErrors((current) => ({ ...current, photos: [] }));
    setPhotos((current) => [...current, ...additions]);
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const item = current[index];
      if (item) {
        URL.revokeObjectURL(item.url);
        photoUrls.current.delete(item.url);
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function movePhoto(index: number, direction: -1 | 1) {
    setPhotos((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fieldErrors: Record<string, string[]> = {};
    if (!projectId) fieldErrors.projectId = ["Choose a project."];
    if (!projectVersion.trim()) fieldErrors.projectVersion = ["Enter the project version."];
    if (!description.trim()) fieldErrors.description = ["Describe the feedback."];
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      window.setTimeout(() => {
        document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      }, 30);
      return;
    }
    setMessage("");
    setStage("review");
  }

  async function save() {
    setPending(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("projectId", projectId);
      body.set("projectVersion", projectVersion);
      body.set("description", description);
      photos.forEach(({ file }) => body.append("photos", file));
      const response = await fetch("/api/feedback", { method: "POST", body });
      if (!response.ok) {
        const result = (await response.json()) as ApiErrorBody;
        setErrors(result.error.fields ?? {});
        setMessage(result.error.message);
        setStage("form");
        window.setTimeout(() => {
          document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
        }, 30);
        return;
      }
      const feedback = (await response.json()) as FeedbackDetailRecord;
      setCreated(feedback);
      setStage("success");
      router.refresh();
    } catch {
      setMessage("Feedy could not reach the server. Check your connection and try again.");
      setStage("form");
    } finally {
      setPending(false);
    }
  }

  const projectName = projects.find((project) => project.id === projectId)?.name ?? "Not selected";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent aria-busy={pending}>
        {stage === "form" ? (
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={review}>
            <SheetHeader>
              <SheetTitle>Add feedback</SheetTitle>
              <SheetDescription>Record what you observed and keep the evidence together.</SheetDescription>
            </SheetHeader>
            {message ? (
              <div className="mx-6 mt-5 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
                {message}
              </div>
            ) : null}
            <SheetBody>
              <FieldGroup>
                <Field data-invalid={Boolean(errors.projectId)}>
                  <FieldLabel htmlFor="feedback-project">Project</FieldLabel>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger aria-invalid={Boolean(errors.projectId)} id="feedback-project">
                      <SelectValue placeholder="Choose a project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError>{errors.projectId?.[0]}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.projectVersion)}>
                  <FieldLabel htmlFor="feedback-version">Project version</FieldLabel>
                  <Input
                    aria-invalid={Boolean(errors.projectVersion)}
                    autoComplete="off"
                    id="feedback-version"
                    maxLength={80}
                    onChange={(event) => setProjectVersion(event.target.value)}
                    placeholder="e.g. 1.4.0 or build-218"
                    ref={versionRef}
                    value={projectVersion}
                  />
                  <FieldDescription>Free text, so build labels and release names work too.</FieldDescription>
                  <FieldError>{errors.projectVersion?.[0]}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.description)}>
                  <FieldLabel htmlFor="feedback-description">Description</FieldLabel>
                  <Textarea
                    aria-invalid={Boolean(errors.description)}
                    id="feedback-description"
                    maxLength={10000}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe what happened, where it happened, and what you expected."
                    rows={7}
                    value={description}
                  />
                  <FieldDescription>{description.length.toLocaleString()} / 10,000</FieldDescription>
                  <FieldError>{errors.description?.[0]}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.photos)}>
                  <FieldLabel htmlFor="feedback-photos">Photos</FieldLabel>
                  <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-muted/35 px-5 py-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <span className="inline-flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:size-5">
                      <ImagePlus aria-hidden="true" />
                    </span>
                    <span className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-foreground">Drop images here or choose files</span>
                      <span className="text-muted-foreground">JPEG, PNG, or WebP · 10 MB each</span>
                    </span>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      id="feedback-photos"
                      multiple
                      onChange={(event) => {
                        addPhotos(Array.from(event.target.files ?? []));
                        event.target.value = "";
                      }}
                      type="file"
                    />
                  </label>
                  <FieldError>{errors.photos?.[0]}</FieldError>
                  {photos.length ? (
                    <div className="grid grid-cols-2 gap-3" aria-label="Selected photos">
                      {photos.map((photo, index) => (
                        <div className="overflow-hidden rounded-lg border bg-card" key={photo.id}>
                          <div className="relative aspect-[4/3] bg-muted">
                            <Image alt={`Selected photo ${index + 1}`} fill sizes="240px" src={photo.url} unoptimized className="object-cover" />
                          </div>
                          <div className="flex items-center justify-between gap-2 p-2.5">
                            <p className="min-w-0 truncate text-xs text-muted-foreground" title={photo.file.name}>
                              {photo.file.name}
                            </p>
                            <div className="flex shrink-0 gap-1">
                              <Button aria-label={`Move ${photo.file.name} earlier`} disabled={index === 0} onClick={() => movePhoto(index, -1)} size="icon" type="button" variant="ghost">
                                <ArrowLeft aria-hidden="true" />
                              </Button>
                              <Button aria-label={`Move ${photo.file.name} later`} disabled={index === photos.length - 1} onClick={() => movePhoto(index, 1)} size="icon" type="button" variant="ghost">
                                <ArrowRight aria-hidden="true" />
                              </Button>
                              <Button aria-label={`Remove ${photo.file.name}`} onClick={() => removePhoto(index)} size="icon" type="button" variant="ghost">
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Field>
              </FieldGroup>
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Review feedback</Button>
            </SheetFooter>
          </form>
        ) : null}

        {stage === "review" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>Review feedback</SheetTitle>
              <SheetDescription>Confirm the record and photo order before saving.</SheetDescription>
            </SheetHeader>
            <SheetBody>
              <dl className="overflow-hidden rounded-lg border bg-card">
                {[
                  ["Project", projectName],
                  ["Version", projectVersion.trim()],
                  ["Description", description.trim()],
                  ["Photos", photos.length ? `${photos.length} attached` : "No photos"]
                ].map(([label, value], index, values) => (
                  <div className={`grid gap-1 px-4 py-4 sm:grid-cols-[8rem_1fr] sm:gap-4 ${index < values.length - 1 ? "border-b" : ""}`} key={label}>
                    <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                    <dd className="whitespace-pre-wrap text-sm leading-6 text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              {photos.length ? (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {photos.map((photo, index) => (
                    <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted" key={photo.id}>
                      <Image alt={`Photo ${index + 1} of ${photos.length}`} fill sizes="160px" src={photo.url} unoptimized className="object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}
            </SheetBody>
            <SheetFooter>
              <Button disabled={pending} type="button" variant="outline" onClick={() => setStage("form")}>
                Back to edit
              </Button>
              <Button disabled={pending} type="button" onClick={save}>
                {pending ? <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" /> : null}
                Save feedback
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {stage === "success" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <SheetHeader>
              <SheetTitle>Feedback saved</SheetTitle>
              <SheetDescription>The record is ready to view or export.</SheetDescription>
            </SheetHeader>
            <SheetBody>
              <div className="flex flex-col items-start gap-4 rounded-lg border bg-card p-5" role="status">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 [&_svg]:size-5">
                  <CheckCircle2 aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-foreground">{created?.projectName} · {created?.projectVersion}</p>
                  <p className="text-sm leading-6 text-muted-foreground">Your description and {created?.photoCount ?? 0} photos were saved together.</p>
                </div>
              </div>
            </SheetBody>
            <SheetFooter>
              {created ? (
                <Button asChild variant="outline">
                  <Link href={`/feedback/${created.id}`}>View feedback</Link>
                </Button>
              ) : null}
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
