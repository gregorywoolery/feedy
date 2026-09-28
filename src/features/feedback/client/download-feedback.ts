import type { FeedbackQuery } from "@/entities/contracts/feedback";

export async function downloadFeedback(
  selection: { ids: string[] } | { query: FeedbackQuery },
) {
  const response = await fetch("/api/feedback/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selection),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error?.message ||
        "The feedback could not be exported. Please try again.",
    );
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const filename = response.headers
    .get("Content-Disposition")
    ?.match(/filename="?([^";]+)"?/i)?.[1];
  anchor.href = objectUrl;
  anchor.download = filename || "feedy-feedback-export.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
