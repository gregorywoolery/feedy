import type {
  FeedbackDataRecord,
  FeedbackDataPage,
} from "@/entities/feedback-data";
import type {
  FeedbackDetailRecord,
  FeedbackPage,
} from "@/entities/contracts/feedback";

export function presentFeedback(
  record: FeedbackDataRecord,
): FeedbackDetailRecord {
  return {
    ...record,
    photos: record.photos.map((photo) => ({
      ...photo,
      url: `/api/photos/${photo.id}`,
    })),
  };
}

export function presentFeedbackPage(page: FeedbackDataPage): FeedbackPage {
  return { ...page, items: page.items.map(presentFeedback) };
}
