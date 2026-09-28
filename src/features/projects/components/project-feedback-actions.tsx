"use client";

import { Download, Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { FeedbackListItem } from "@/entities/contracts/feedback";
import { DeleteFeedbackDialog } from "@/features/feedback/components/delete-feedback-dialog";
import { EditFeedbackSheet } from "@/features/feedback/components/edit-feedback-sheet";

export function ProjectFeedbackActions({
  item,
  compact = false,
}: {
  item: FeedbackListItem;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2 border-t pt-4">
        <Button asChild variant="outline">
          <Link href={`/feedback/${item.id}`} prefetch={false}>
            <Eye aria-hidden="true" data-icon="inline-start" />
            View
          </Link>
        </Button>
        <EditFeedbackSheet
          feedback={item}
          trigger={
            <Button type="button" variant="outline">
              <Pencil aria-hidden="true" data-icon="inline-start" />
              Edit
            </Button>
          }
        />
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
        <Link
          aria-label={`View feedback for version ${item.projectVersion}`}
          href={`/feedback/${item.id}`}
          prefetch={false}
        >
          <Eye aria-hidden="true" />
        </Link>
      </Button>
      <EditFeedbackSheet
        feedback={item}
        trigger={
          <Button
            aria-label={`Edit feedback for version ${item.projectVersion}`}
            size="icon-sm"
            title="Edit feedback"
            type="button"
            variant="ghost"
          >
            <Pencil aria-hidden="true" />
          </Button>
        }
      />
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
