import {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_COUNT,
  MAX_TOTAL_PHOTO_BYTES,
} from "@/lib/validation/photo-limits";

export interface ExistingPhotoDraft {
  kind: "existing";
  id: string;
  url: string;
  filename: string;
  size: number;
}
export interface NewPhotoDraft {
  kind: "new";
  id: string;
  url: string;
  filename: string;
  size: number;
  file: File;
}
export type PhotoDraft = ExistingPhotoDraft | NewPhotoDraft;

export function newPhotoDraft(file: File): NewPhotoDraft {
  return {
    kind: "new",
    id: crypto.randomUUID(),
    url: URL.createObjectURL(file),
    filename: file.name,
    size: file.size,
    file,
  };
}

export function photoSelectionError(
  existing: Array<{ size: number }>,
  files: File[],
): string {
  if (existing.length + files.length > MAX_PHOTO_COUNT)
    return `Add no more than ${MAX_PHOTO_COUNT} photos.`;
  if (
    files.some(
      (file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type),
    )
  )
    return "Choose JPEG, PNG, or WebP images only.";
  if (files.some((file) => file.size === 0))
    return "Choose a photo that is not empty.";
  if (files.some((file) => file.size > MAX_PHOTO_BYTES))
    return "Each photo must be 10 MB or less.";
  const total =
    existing.reduce((sum, photo) => sum + photo.size, 0) +
    files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_PHOTO_BYTES)
    return "Photos must be 50 MB or less in total.";
  return "";
}
