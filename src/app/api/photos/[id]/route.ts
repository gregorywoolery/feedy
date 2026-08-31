import { errorResponse } from "@/lib/http/api-response";
import { feedbackIdSchema } from "@/lib/validation/feedback";
import { getPhotoUseCase } from "@/use-cases/feedback/get-photo";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!feedbackIdSchema.safeParse(id).success) {
    return errorResponse(400, "INVALID_PHOTO_ID", "The photo identifier is invalid.");
  }

  try {
    const photo = await getPhotoUseCase(id);
    if (!photo) return errorResponse(404, "PHOTO_NOT_FOUND", "Photo not found.");
    return new Response(Buffer.from(photo.bytes), {
      headers: {
        "Content-Type": photo.mimeType,
        "Content-Length": String(photo.bytes.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Photo read failed", error);
    return errorResponse(404, "PHOTO_NOT_FOUND", "Photo not found.");
  }
}
