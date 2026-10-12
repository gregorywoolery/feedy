import { mkdtemp, rm, utimes, writeFile, access } from "node:fs/promises";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, getDatabasePool } from "@/lib/database/client";
import { photoCleanupJobs } from "@/lib/database/schema";
import * as feedback from "@/data-access/feedback/feedback-repository";
import * as projects from "@/data-access/projects/project-repository";
import { DatabasePhotoStorage } from "@/lib/storage/database";
import { LocalPhotoStorage } from "@/lib/storage/local";
import { cleanupPhotos, retryPhotoCleanup } from "@/lib/storage/cleanup";
import { findOrphanPhotoKeys } from "@/lib/storage/reconcile";

const metadata = {
  originalFilename: "test.png",
  mimeType: "image/png" as const,
  sizeBytes: 3,
  width: 1,
  height: 1,
  sortOrder: 0,
};
afterAll(async () => {
  await getDatabasePool().end();
});

describe("persistent photo lifecycle", () => {
  it("round-trips database photos and retries a deletion after a simulated failure", async () => {
    const storage = new DatabasePhotoStorage();
    const project = await projects.createProject({
      name: "Integration cleanup",
      description: null,
    });
    const { key } = await storage.put({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
    });
    try {
      const id = await feedback.createFeedbackRecord({
        projectId: project.id,
        projectVersion: "1",
        description: "test",
        photos: [{ ...metadata, storageKey: key }],
      });
      expect(Array.from((await storage.get(key)).bytes)).toEqual([1, 2, 3]);
      await feedback.deleteFeedbackRecords([id], storage.namespace);
      const failingStorage = {
        namespace: storage.namespace,
        put: storage.put.bind(storage),
        get: storage.get.bind(storage),
        async delete() {
          throw new Error("simulated storage outage");
        },
      };
      expect(await cleanupPhotos(failingStorage, [key])).toBe(1);
      expect(
        await db
          .select()
          .from(photoCleanupJobs)
          .where(eq(photoCleanupJobs.storageKey, key)),
      ).toHaveLength(1);
      expect(await retryPhotoCleanup(new DatabasePhotoStorage())).toBe(0);
      await expect(storage.get(key)).rejects.toThrow("could not be found");
      expect(
        await db
          .select()
          .from(photoCleanupJobs)
          .where(eq(photoCleanupJobs.storageKey, key)),
      ).toHaveLength(0);
    } finally {
      await projects.deleteProjectRecord(project.id, storage.namespace);
      await cleanupPhotos(storage, [key]);
    }
  });
  it("rolls back all metadata if a photo violates a database constraint", async () => {
    const project = await projects.createProject({
      name: "Integration rollback",
      description: null,
    });
    try {
      await expect(
        feedback.createFeedbackRecord({
          projectId: project.id,
          projectVersion: "1",
          description: "test",
          photos: [{ ...metadata, sizeBytes: 0, storageKey: "invalid" }],
        }),
      ).rejects.toThrow();
      expect((await projects.getProjectById(project.id))?.feedbackCount).toBe(
        0,
      );
    } finally {
      await projects.deleteProjectRecord(project.id, "database");
    }
  });
  it("serializes competing photo edits without corrupting ordering", async () => {
    const storage = new DatabasePhotoStorage();
    const project = await projects.createProject({
      name: "Integration concurrent edits",
      description: null,
    });
    const first = await storage.put({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
    });
    const second = await storage.put({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
    });
    try {
      const id = await feedback.createFeedbackRecord({
        projectId: project.id,
        projectVersion: "1",
        description: "test",
        photos: [
          { ...metadata, storageKey: first.key },
          { ...metadata, storageKey: second.key, sortOrder: 1 },
        ],
      });
      const record = await feedback.getFeedbackById(id);
      const photos = record!.photos;
      await Promise.all(
        [0, 1].map((turn) =>
          feedback.updateFeedbackRecord({
            feedbackId: id,
            projectVersion: "2",
            description: "edited",
            newPhotos: [],
            expectedPhotoIds: photos.map((photo) => photo.id),
            retainedPhotos: photos.map((photo, index) => ({
              id: photo.id,
              sortOrder: turn ? 1 - index : index,
            })),
            storageNamespace: storage.namespace,
          }),
        ),
      );
      expect(
        (await feedback.getFeedbackById(id))!.photos.map(
          (photo) => photo.sortOrder,
        ),
      ).toEqual([0, 1]);
    } finally {
      const result = await projects.deleteProjectRecord(
        project.id,
        storage.namespace,
      );
      await cleanupPhotos(storage, result.storageKeys);
    }
  });
  it("rejects a stale photo snapshot without deleting a concurrent upload", async () => {
    const storage = new DatabasePhotoStorage();
    const project = await projects.createProject({
      name: "Concurrent upload",
      description: null,
    });
    const { key } = await storage.put({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
    });
    try {
      const id = await feedback.createFeedbackRecord({
        projectId: project.id,
        projectVersion: "1",
        description: "test",
        photos: [],
      });
      await feedback.updateFeedbackRecord({
        feedbackId: id,
        projectVersion: "2",
        description: "added",
        expectedPhotoIds: [],
        retainedPhotos: [],
        newPhotos: [{ ...metadata, storageKey: key }],
        storageNamespace: storage.namespace,
      });
      await expect(
        feedback.updateFeedbackRecord({
          feedbackId: id,
          projectVersion: "2",
          description: "stale",
          expectedPhotoIds: [],
          retainedPhotos: [],
          newPhotos: [],
          storageNamespace: storage.namespace,
        }),
      ).rejects.toThrow("attached photos changed");
      expect((await feedback.getFeedbackById(id))!.photoCount).toBe(1);
      expect(Array.from((await storage.get(key)).bytes)).toEqual([1, 2, 3]);
    } finally {
      const result = await projects.deleteProjectRecord(
        project.id,
        storage.namespace,
      );
      await cleanupPhotos(storage, result.storageKeys);
    }
  });
  it("loads the schema from .env before maintenance checks live photos", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "feedy-maintenance-"),
    );
    const storage = new LocalPhotoStorage({
      uploadDir: path.join(directory, "uploads"),
    });
    const schema = `maintenance_${randomUUID().replaceAll("-", "")}`;
    const pool = getDatabasePool();
    try {
      await pool.query(`CREATE SCHEMA "${schema}"`);
      await pool.query(
        `CREATE TABLE "${schema}".feedback_photos (id uuid, storage_key text)`,
      );
      await pool.query(
        `CREATE TABLE "${schema}".photo_cleanup_jobs (storage_key text PRIMARY KEY, storage_namespace text, created_at timestamptz DEFAULT now())`,
      );
      const { key } = await storage.put({
        bytes: new Uint8Array([1]),
        mimeType: "image/png",
      });
      await pool.query(
        `INSERT INTO "${schema}".feedback_photos VALUES ($1, $2)`,
        [randomUUID(), key],
      );
      await pool.query(
        `INSERT INTO "${schema}".photo_cleanup_jobs (storage_key, storage_namespace) VALUES ($1, $2)`,
        [key, storage.namespace],
      );
      const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await utimes(path.join(storage.uploadDir, key), old, old);
      await writeFile(
        path.join(directory, ".env"),
        `DATABASE_SCHEMA=${schema}\nSTORAGE_DRIVER=local\nUPLOAD_DIR=${storage.uploadDir}\n`,
      );
      const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
      delete env.DATABASE_SCHEMA;
      delete env.STORAGE_DRIVER;
      delete env.UPLOAD_DIR;
      const run = promisify(execFile);
      for (const script of ["storage-reconcile.ts", "storage-cleanup.ts"]) {
        await run(
          process.execPath,
          [
            path.resolve("node_modules/tsx/dist/cli.mjs"),
            "--tsconfig",
            path.resolve("tsconfig.json"),
            path.resolve("scripts", script),
            "--apply",
          ],
          { cwd: directory, env },
        );
        await expect(
          access(path.join(storage.uploadDir, key)),
        ).resolves.toBeUndefined();
      }
      expect(
        (await pool.query(`SELECT * FROM "${schema}".photo_cleanup_jobs`)).rows,
      ).toHaveLength(0);
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await rm(directory, { recursive: true, force: true });
    }
  }, 20000);
  it("reconciliation ignores recent local objects and finds old unreferenced ones", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "feedy-reconcile-"));
    const storage = new LocalPhotoStorage({ uploadDir: directory });
    try {
      const { key } = await storage.put({
        bytes: new Uint8Array([1]),
        mimeType: "image/png",
      });
      expect(await findOrphanPhotoKeys(storage)).toEqual([]);
      const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await utimes(path.join(directory, key), old, old);
      expect(await findOrphanPhotoKeys(storage)).toEqual([key]);
      expect(await cleanupPhotos(storage, [key])).toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
