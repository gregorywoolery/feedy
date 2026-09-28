"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DeleteFeedbackDialog({
  ids,
  trigger,
  onDeleted,
  redirectTo,
}: {
  ids: string[];
  trigger: ReactNode;
  onDeleted?: () => void;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const count = ids.length;

  async function deleteFeedback() {
    if (!count || isDeleting) return;
    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/feedback", {
        body: JSON.stringify({ ids }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message || "Feedback could not be deleted. Try again.",
        );
      }

      setOpen(false);
      onDeleted?.();
      toast.success(
        `${count} feedback ${count === 1 ? "item" : "items"} deleted.`,
      );
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Feedback could not be deleted. Try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count === 1 ? "this feedback" : `${count} feedback items`}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the selected feedback and every attached
            photo. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              void deleteFeedback();
            }}
          >
            {isDeleting ? (
              <Loader2
                aria-hidden="true"
                className="animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <Trash2 aria-hidden="true" data-icon="inline-start" />
            )}
            {isDeleting ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
