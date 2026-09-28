import type {
  FeedbackDetailRecord,
  FeedbackPage,
  FeedbackPhotoRecord,
} from "./contracts/feedback";

// Persistence knows photo identifiers, not HTTP routes.
export type FeedbackPhotoData = Omit<FeedbackPhotoRecord, "url">;
export interface FeedbackDataRecord extends Omit<
  FeedbackDetailRecord,
  "photos"
> {
  photos: FeedbackPhotoData[];
}
export interface FeedbackDataPage extends Omit<FeedbackPage, "items"> {
  items: FeedbackDataRecord[];
}
