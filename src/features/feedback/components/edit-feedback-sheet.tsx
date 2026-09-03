"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ApiErrorBody } from "@/entities/contracts/api";
import type { FeedbackDetailRecord } from "@/entities/contracts/feedback";
import { MAX_PHOTO_BYTES, MAX_PHOTO_COUNT, MAX_TOTAL_PHOTO_BYTES } from "@/lib/validation/photo-limits";
import { PhotoPreviewDialog, PhotoPreviewOverlay } from "./photo-preview-dialog";

type EditPhoto = { kind: "existing"; id: string; url: string; filename: string; size: number } | { kind: "new"; id: string; url: string; filename: string; size: number; file: File };

export function EditFeedbackSheet({ feedback, trigger }: { feedback: FeedbackDetailRecord; trigger: ReactNode }) {
  const router = useRouter();
  const objectUrls = useRef(new Set<string>());
  const initialPhotos = () => feedback.photos.map((photo): EditPhoto => ({ kind: "existing", id: photo.id, url: photo.url, filename: photo.originalFilename, size: photo.sizeBytes }));
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(feedback.projectVersion);
  const [description, setDescription] = useState(feedback.description);
  const [photos, setPhotos] = useState<EditPhoto[]>(initialPhotos);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => { const urls = objectUrls.current; return () => urls.forEach(URL.revokeObjectURL); }, []);
  function reset() { objectUrls.current.forEach(URL.revokeObjectURL); objectUrls.current.clear(); setVersion(feedback.projectVersion); setDescription(feedback.description); setPhotos(initialPhotos()); setErrors({}); }
  function changeOpen(next: boolean) { if (pending) return; setOpen(next); if (!next) window.setTimeout(reset, 220); }
  function addPhotos(files: File[]) {
    const total = photos.reduce((sum, photo) => sum + photo.size, 0) + files.reduce((sum, file) => sum + file.size, 0);
    const message = photos.length + files.length > MAX_PHOTO_COUNT ? `Add no more than ${MAX_PHOTO_COUNT} photos.` : files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type)) ? "Choose JPEG, PNG, or WebP images only." : files.some((file) => file.size > MAX_PHOTO_BYTES) ? "Each photo must be 10 MB or less." : total > MAX_TOTAL_PHOTO_BYTES ? "Photos must be 50 MB or less in total." : "";
    if (message) return setErrors((current) => ({ ...current, photos: [message] }));
    const additions = files.map((file): EditPhoto => { const url = URL.createObjectURL(file); objectUrls.current.add(url); return { kind: "new", id: crypto.randomUUID(), file, url, filename: file.name, size: file.size }; });
    setPhotos((current) => [...current, ...additions]); setErrors((current) => ({ ...current, photos: [] }));
  }
  function remove(index: number) { setPhotos((current) => { const photo = current[index]; if (photo?.kind === "new") { URL.revokeObjectURL(photo.url); objectUrls.current.delete(photo.url); } return current.filter((_, i) => i !== index); }); }
  function move(index: number, direction: -1 | 1) { setPhotos((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); const nextErrors: Record<string, string[]> = {};
    if (!version.trim()) nextErrors.projectVersion = ["Enter the project version."]; if (!description.trim()) nextErrors.description = ["Describe the feedback."];
    if (Object.keys(nextErrors).length) return setErrors(nextErrors);
    setPending(true);
    try {
      const body = new FormData(); body.set("projectVersion", version); body.set("description", description); body.set("photoOrder", JSON.stringify(photos.map(({ kind, id }) => ({ kind, id }))));
      photos.filter((photo): photo is Extract<EditPhoto, { kind: "new" }> => photo.kind === "new").forEach((photo) => { body.append("newPhotoIds", photo.id); body.append("newPhotos", photo.file); });
      const response = await fetch(`/api/feedback/${feedback.id}`, { method: "PATCH", body });
      if (!response.ok) { const result = (await response.json()) as ApiErrorBody; setErrors(result.error.fields ?? {}); throw new Error(result.error.message); }
      toast.success("Feedback updated."); setOpen(false); window.setTimeout(reset, 220); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Feedback could not be updated."); } finally { setPending(false); }
  }
  return <Sheet open={open} onOpenChange={changeOpen}><SheetTrigger asChild>{trigger}</SheetTrigger><SheetContent aria-busy={pending}>
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}><SheetHeader><SheetTitle>Edit feedback</SheetTitle><SheetDescription>Update the version, description, and visual evidence for {feedback.projectName}.</SheetDescription></SheetHeader>
      <SheetBody><FieldGroup><Field><FieldLabel>Project</FieldLabel><Input disabled value={feedback.projectName} /></Field>
        <Field data-invalid={Boolean(errors.projectVersion)}><FieldLabel htmlFor={`edit-version-${feedback.id}`}>Project version</FieldLabel><Input aria-invalid={Boolean(errors.projectVersion)} id={`edit-version-${feedback.id}`} maxLength={80} onChange={(e) => setVersion(e.target.value)} value={version} /><FieldError>{errors.projectVersion?.[0]}</FieldError></Field>
        <Field data-invalid={Boolean(errors.description)}><FieldLabel htmlFor={`edit-description-${feedback.id}`}>Description</FieldLabel><Textarea aria-invalid={Boolean(errors.description)} id={`edit-description-${feedback.id}`} maxLength={10000} onChange={(e) => setDescription(e.target.value)} rows={7} value={description} /><FieldDescription>{description.length.toLocaleString()} / 10,000</FieldDescription><FieldError>{errors.description?.[0]}</FieldError></Field>
        <Field data-invalid={Boolean(errors.photos)}><FieldLabel htmlFor={`edit-photos-${feedback.id}`}>Photos</FieldLabel><label className="flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/35 px-5 py-5 text-sm font-medium hover:border-primary/50"><ImagePlus aria-hidden="true" className="size-5" />Add photos<input accept="image/jpeg,image/png,image/webp" className="sr-only" id={`edit-photos-${feedback.id}`} multiple onChange={(e) => { addPhotos(Array.from(e.target.files ?? [])); e.target.value = ""; }} type="file" /></label><FieldError>{errors.photos?.[0]}</FieldError>
          <div className="grid grid-cols-2 gap-3">{photos.map((photo, index) => <div className="overflow-hidden rounded-lg border bg-card" key={photo.id}><PhotoPreviewDialog filename={photo.filename} src={photo.url}><button aria-label={`View ${photo.filename} full size`} className="relative block aspect-[4/3] w-full bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" type="button"><Image alt={photo.filename} className="object-cover" fill sizes="240px" src={photo.url} unoptimized /><PhotoPreviewOverlay /></button></PhotoPreviewDialog><div className="flex items-center justify-between gap-1 p-2"><span className="truncate text-xs" title={photo.filename}>{photo.filename}</span><div className="flex"><Button aria-label={`Move ${photo.filename} earlier`} disabled={index === 0} onClick={() => move(index, -1)} size="icon" type="button" variant="ghost"><ArrowLeft /></Button><Button aria-label={`Move ${photo.filename} later`} disabled={index === photos.length - 1} onClick={() => move(index, 1)} size="icon" type="button" variant="ghost"><ArrowRight /></Button><Button aria-label={`Remove ${photo.filename}`} onClick={() => remove(index)} size="icon" type="button" variant="ghost"><Trash2 /></Button></div></div></div>)}</div>
        </Field></FieldGroup></SheetBody><SheetFooter><Button disabled={pending} onClick={() => changeOpen(false)} type="button" variant="outline">Cancel</Button><Button disabled={pending} type="submit">{pending ? <Loader2 className="animate-spin" /> : null}Save changes</Button></SheetFooter></form>
  </SheetContent></Sheet>;
}
