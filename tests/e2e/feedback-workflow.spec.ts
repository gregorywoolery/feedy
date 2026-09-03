import { randomUUID } from "node:crypto";

import { expect, test, type Download, type Page } from "@playwright/test";
import sharp from "sharp";

const TEST_PNG = sharp({
  create: {
    background: { alpha: 1, b: 190, g: 110, r: 45 },
    channels: 4,
    height: 48,
    width: 64
  }
})
  .png()
  .toBuffer();

type CreatedFeedback = {
  id: string;
  photoCount: number;
  projectName: string;
  projectVersion: string;
};

type CreatedProject = {
  id: string;
  name: string;
};

function responseIs(pagePath: string, method: string) {
  return (response: { request: () => { method: () => string }; url: () => string }) => {
    const url = new URL(response.url());
    return url.pathname === pagePath && response.request().method() === method;
  };
}

async function createProject(page: Page, name: string, description: string) {
  await page.getByRole("button", { name: "New project", exact: true }).first().click();

  const sheet = page.getByRole("dialog", { name: "New project" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Project name").fill(name);
  await sheet.getByLabel("Description").fill(description);
  await sheet.getByRole("button", { name: "Review project" }).click();

  await expect(page.getByRole("heading", { name: "Review project" })).toBeVisible();
  await expect(page.getByRole("dialog").locator("dd").filter({ hasText: name })).toBeVisible();
  await expect(
    page.getByRole("dialog").locator("dd").filter({ hasText: description })
  ).toBeVisible();

  const projectResponsePromise = page.waitForResponse(responseIs("/api/projects", "POST"));
  await page.getByRole("dialog").getByRole("button", { name: "Create project" }).click();
  const projectResponse = await projectResponsePromise;

  expect(projectResponse.ok()).toBeTruthy();
  const created = (await projectResponse.json()) as CreatedProject;
  await expect(page.getByRole("heading", { name: "Project created" })).toBeVisible();
  await expect(page.getByText(`${name} is ready for feedback.`)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  return created;
}

async function createFeedback(
  page: Page,
  input: {
    projectName: string;
    projectVersion: string;
    description: string;
    attachPhoto: boolean;
  }
) {
  await page.getByRole("button", { name: "New feedback", exact: true }).first().click();

  const sheet = page.getByRole("dialog", { name: "Add feedback" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("combobox", { name: "Project" }).click();
  await page.getByRole("option", { name: input.projectName, exact: true }).click();
  await sheet.getByLabel("Project version").fill(input.projectVersion);
  await sheet.getByLabel("Description").fill(input.description);

  if (input.attachPhoto) {
    await sheet.locator("#feedback-photos").setInputFiles({
      buffer: await TEST_PNG,
      mimeType: "image/png",
      name: "workflow-evidence.png"
    });
    await expect(sheet.getByAltText("Selected photo 1")).toBeVisible();
    await expect(sheet.getByText("workflow-evidence.png")).toBeVisible();
    await sheet.getByRole("button", { name: "View workflow-evidence.png full size" }).click();
    await expect(page.getByRole("heading", { name: "workflow-evidence.png" })).toBeVisible();
    await expect(page.getByRole("img", { name: "workflow-evidence.png" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
  }

  await sheet.getByRole("button", { name: "Review feedback" }).click();
  await expect(page.getByRole("heading", { name: "Review feedback" })).toBeVisible();
  await expect(page.getByRole("dialog").locator("dd").filter({ hasText: input.projectName })).toBeVisible();
  await expect(page.getByRole("dialog").locator("dd").filter({ hasText: input.projectVersion })).toBeVisible();
  await expect(page.getByRole("dialog").locator("dd").filter({ hasText: input.description })).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .locator("dd")
      .filter({ hasText: input.attachPhoto ? "1 attached" : "No photos" })
  ).toBeVisible();

  const feedbackResponsePromise = page.waitForResponse(responseIs("/api/feedback", "POST"));
  await page.getByRole("dialog").getByRole("button", { name: "Save feedback" }).click();
  const feedbackResponse = await feedbackResponsePromise;

  expect(feedbackResponse.ok()).toBeTruthy();
  const created = (await feedbackResponse.json()) as CreatedFeedback;
  expect(created.projectName).toBe(input.projectName);
  expect(created.projectVersion).toBe(input.projectVersion);
  expect(created.photoCount).toBe(input.attachPhoto ? 1 : 0);

  await expect(page.getByRole("heading", { name: "Feedback saved" })).toBeVisible();
  await expect(
    page.getByText(
      `Your description and ${input.attachPhoto ? 1 : 0} photos were saved together.`
    )
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  return created;
}

async function expectPdfDownload(download: Download) {
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  expect(await download.failure()).toBeNull();

  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();

  const chunks: Buffer[] = [];
  for await (const chunk of stream!) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const contents = Buffer.concat(chunks);
  expect(contents.length).toBeGreaterThan(100);
  expect(contents.subarray(0, 5).toString("ascii")).toBe("%PDF-");
}

async function waitForDashboardIdle(page: Page) {
  await expect(page.getByRole("region", { name: "Feedback records" })).toHaveAttribute(
    "aria-busy",
    "false"
  );
}

test("creates, filters, exports, and deletes project feedback through side sheets", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  const token = `${testInfo.project.name.replace(/\W+/g, "-")}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const searchToken = `workflow-${token}`;
  const projectName = `E2E project ${token}`;
  const projectDescription = `Project created by ${searchToken}`;
  let photoVersion = `photo-${token}`;
  const plainVersion = `plain-${token}`;
  const deleteVersion = `delete-${token}`;
  let photoDescription = `${searchToken} feedback with visual evidence`;
  const plainDescription = `${searchToken} feedback without an attachment`;
  const deleteDescription = `${searchToken} feedback created for single deletion`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Feedback", exact: true })).toBeVisible();

  const project = await createProject(page, projectName, projectDescription);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Feedback", exact: true })).toBeVisible();

  const withPhoto = await createFeedback(page, {
    attachPhoto: true,
    description: photoDescription,
    projectName,
    projectVersion: photoVersion
  });
  const withoutPhoto = await createFeedback(page, {
    attachPhoto: false,
    description: plainDescription,
    projectName,
    projectVersion: plainVersion
  });
  const deleteTarget = await createFeedback(page, {
    attachPhoto: false,
    description: deleteDescription,
    projectName,
    projectVersion: deleteVersion
  });

  await page.goto(`/feedback/${withPhoto.id}`);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await page.getByRole("button", { name: "Edit feedback" }).click();
  const editSheet = page.getByRole("dialog", { name: "Edit feedback" });
  photoVersion = `edited-${token}`;
  photoDescription = `${searchToken} edited feedback with visual evidence`;
  await editSheet.getByLabel("Project version").fill(photoVersion);
  await editSheet.getByLabel("Description").fill(photoDescription);
  await editSheet.getByRole("button", { name: "View workflow-evidence.png full size" }).click();
  await expect(page.getByRole("heading", { name: "workflow-evidence.png" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  const updateResponsePromise = page.waitForResponse(responseIs(`/api/feedback/${withPhoto.id}`, "PATCH"));
  await editSheet.getByRole("button", { name: "Save changes" }).click();
  expect((await updateResponsePromise).ok()).toBeTruthy();
  await expect(page.getByText(photoDescription, { exact: true })).toBeVisible();
  await expect(page.getByText(`Feedback for version ${photoVersion}`)).toBeVisible();
  await page.goto("/");

  await page.getByRole("searchbox", { name: "Search feedback" }).fill(searchToken);
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(searchToken);
  await expect(page.getByText("Showing 1–3 of 3 records")).toBeVisible();
  await expect(page.getByText(photoDescription, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(plainDescription, { exact: true }).filter({ visible: true })).toBeVisible();
  await waitForDashboardIdle(page);

  await page.getByRole("combobox", { name: "Filter by photo attachment" }).click();
  await page.getByRole("option", { name: "With photos", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("hasPhotos")).toBe("yes");
  await expect(page.getByText("Showing 1–1 of 1 record")).toBeVisible();
  await expect(page.getByText(photoDescription, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(plainDescription, { exact: true }).filter({ visible: true })).toHaveCount(0);
  await waitForDashboardIdle(page);

  const singlePdfPromise = page.waitForEvent("download");
  await page.locator(`a[href="/api/feedback/${withPhoto.id}/export"]:visible`).click();
  await expectPdfDownload(await singlePdfPromise);

  await page.getByRole("combobox", { name: "Filter by photo attachment" }).click();
  await page.getByRole("option", { name: "All photos", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("hasPhotos")).toBeNull();
  await expect(page.getByText("Showing 1–3 of 3 records")).toBeVisible();
  await waitForDashboardIdle(page);

  await page.getByRole("checkbox", { name: `Select feedback for ${projectName}, version ${photoVersion}` }).click();
  await page.getByRole("checkbox", { name: `Select feedback for ${projectName}, version ${plainVersion}` }).click();
  await expect(page.getByText("2 records selected")).toBeVisible();

  const batchPdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download selected" }).click();
  await expectPdfDownload(await batchPdfPromise);
  await expect(page.getByText("Your PDF download has started.")).toBeVisible();

  const filteredPdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download filtered" }).click();
  await expectPdfDownload(await filteredPdfPromise);

  await page.goto(`/projects/${project.id}`);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByText(/Last activity/)).not.toContainText("UTC");
  await page.getByRole("searchbox", { name: "Search project feedback" }).fill(photoDescription);
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(photoDescription);
  await expect(page.getByText(photoDescription, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(plainDescription, { exact: true }).filter({ visible: true })).toHaveCount(0);

  const projectPdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download filtered \(1\)/ }).click();
  await expectPdfDownload(await projectPdfPromise);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBeNull();

  const deleteDescriptionNode = page.getByText(deleteDescription, { exact: true }).filter({ visible: true });
  const deleteContainer = deleteDescriptionNode.locator(
    "xpath=ancestor::*[self::tr or self::div][.//button[contains(@aria-label,'Delete') or normalize-space()='Delete']][1]"
  );
  await deleteContainer.getByRole("button", { name: /Delete/ }).click();
  const singleDeleteDialog = page.getByRole("alertdialog");
  await expect(singleDeleteDialog).toContainText("Delete this feedback?");
  await singleDeleteDialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText(deleteDescription, { exact: true }).filter({ visible: true })).toHaveCount(0);

  await page.goto(`/?q=${encodeURIComponent(searchToken)}`);
  await expect(page.getByText("Showing 1–2 of 2 records")).toBeVisible();
  await page.getByRole("checkbox", { name: `Select feedback for ${projectName}, version ${photoVersion}` }).click();
  await page.getByRole("checkbox", { name: `Select feedback for ${projectName}, version ${plainVersion}` }).click();
  await page.getByRole("button", { name: "Delete selected" }).click();
  const bulkDeleteDialog = page.getByRole("alertdialog");
  await expect(bulkDeleteDialog).toContainText("Delete 2 feedback items?");
  await bulkDeleteDialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("No matching feedback")).toBeVisible();

  await page.goto(`/projects/${project.id}`);
  await expect(page.getByText("No feedback yet")).toBeVisible();
  await page.getByRole("button", { name: "Delete project", exact: true }).click();
  const projectDeleteDialog = page.getByRole("alertdialog");
  await expect(projectDeleteDialog).toContainText(`Delete ${projectName}?`);
  await projectDeleteDialog.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByText(projectName, { exact: true })).toHaveCount(0);

  expect(withPhoto.id).not.toBe(withoutPhoto.id);
  expect(deleteTarget.id).not.toBe(withPhoto.id);
});

test("tracks recent projects and persists pinning in the workspace navigation", async ({ page }, testInfo) => {
  const token = `${testInfo.project.name.replace(/\W+/g, "-")}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const projectName = `Recent project ${token}`;

  await page.goto("/");
  const project = await createProject(page, projectName, "Temporary project for recent and pinned navigation coverage.");
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }

  const recentRegion = page.getByRole("region", { name: "Recent projects" });
  await expect(recentRegion.getByRole("link", { name: projectName })).toBeVisible();
  await recentRegion.getByRole("button", { name: `Pin ${projectName}` }).click();
  await expect(recentRegion.getByRole("button", { name: `Unpin ${projectName}` })).toHaveAttribute("aria-pressed", "true");

  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeHidden();
  }

  await page.getByRole("button", { name: "Delete project", exact: true }).click();
  const projectDeleteDialog = page.getByRole("alertdialog");
  await expect(projectDeleteDialog).toContainText(`Delete ${projectName}?`);
  await projectDeleteDialog.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/projects$/);
});
