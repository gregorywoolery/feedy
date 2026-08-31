import { relations, sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  pgSchema,
  pgTable,
  type PgTableFn,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { getDatabaseSchema } from "@/lib/database/config";

const databaseSchema = getDatabaseSchema();
const applicationTable =
  (databaseSchema === "public"
    ? pgTable
    : pgSchema(databaseSchema).table) as PgTableFn<string | undefined>;

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const projects = applicationTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [
    check(
      "projects_name_not_blank_check",
      sql`char_length(btrim(${table.name})) between 1 and 160`,
    ),
    check(
      "projects_description_length_check",
      sql`${table.description} is null or char_length(${table.description}) <= 4000`,
    ),
    index("projects_name_lower_idx").on(sql`lower(${table.name})`),
    index("projects_updated_at_idx").on(table.updatedAt.desc()),
  ],
);

export const feedbackItems = applicationTable(
  "feedback_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    projectVersion: varchar("project_version", { length: 80 }).notNull(),
    description: text("description").notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "feedback_items_project_version_not_blank_check",
      sql`char_length(btrim(${table.projectVersion})) between 1 and 80`,
    ),
    check(
      "feedback_items_description_length_check",
      sql`char_length(btrim(${table.description})) between 1 and 10000`,
    ),
    index("feedback_items_project_created_at_idx").on(
      table.projectId,
      table.createdAt.desc(),
    ),
    index("feedback_items_project_version_idx").on(table.projectVersion),
    index("feedback_items_created_at_idx").on(table.createdAt.desc()),
    index("feedback_items_updated_at_idx").on(table.updatedAt.desc()),
  ],
);

export const feedbackPhotos = applicationTable(
  "feedback_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    feedbackId: uuid("feedback_id")
      .notNull()
      .references(() => feedbackItems.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 80 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("feedback_photos_storage_key_idx").on(table.storageKey),
    unique("feedback_photos_feedback_id_sort_order_unique").on(
      table.feedbackId,
      table.sortOrder,
    ),
    index("feedback_photos_feedback_id_sort_order_idx").on(
      table.feedbackId,
      table.sortOrder,
    ),
    check(
      "feedback_photos_original_filename_not_blank_check",
      sql`char_length(btrim(${table.originalFilename})) between 1 and 255`,
    ),
    check(
      "feedback_photos_mime_type_check",
      sql`${table.mimeType} in ('image/jpeg', 'image/png', 'image/webp')`,
    ),
    check(
      "feedback_photos_size_bytes_check",
      sql`${table.sizeBytes} between 1 and 10485760`,
    ),
    check(
      "feedback_photos_width_check",
      sql`${table.width} is null or ${table.width} > 0`,
    ),
    check(
      "feedback_photos_height_check",
      sql`${table.height} is null or ${table.height} > 0`,
    ),
    check(
      "feedback_photos_sort_order_check",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const photoObjects = applicationTable(
  "photo_objects",
  {
    key: text("key").primaryKey(),
    bytes: bytea("bytes").notNull(),
    mimeType: varchar("mime_type", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "photo_objects_key_check",
      sql`${table.key} ~ '^[a-f0-9]{64}\\.(jpg|png|webp)$'`,
    ),
    check(
      "photo_objects_mime_type_check",
      sql`${table.mimeType} in ('image/jpeg', 'image/png', 'image/webp')`,
    ),
  ],
);

export const projectsRelations = relations(projects, ({ many }) => ({
  feedbackItems: many(feedbackItems),
}));

export const feedbackItemsRelations = relations(
  feedbackItems,
  ({ many, one }) => ({
    project: one(projects, {
      fields: [feedbackItems.projectId],
      references: [projects.id],
    }),
    photos: many(feedbackPhotos),
  }),
);

export const feedbackPhotosRelations = relations(feedbackPhotos, ({ one }) => ({
  feedback: one(feedbackItems, {
    fields: [feedbackPhotos.feedbackId],
    references: [feedbackItems.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type FeedbackItem = typeof feedbackItems.$inferSelect;
export type NewFeedbackItem = typeof feedbackItems.$inferInsert;
export type FeedbackPhoto = typeof feedbackPhotos.$inferSelect;
export type NewFeedbackPhoto = typeof feedbackPhotos.$inferInsert;
export type PhotoObject = typeof photoObjects.$inferSelect;
