// Behavior: every tool's main path through the API, one browser journey, a phone smoke.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { degrees } from "pdf-lib";
import {
  makePdf,
  makePng,
  upload,
  runTask,
  download,
  loadPdf,
  pageTexts,
  pdf,
  png,
} from "./lib.mjs";

const runtime = await startRuntime();
try {
  const five = await makePdf([
    "page one",
    "page two",
    "page three",
    "page four",
    "page five",
  ]);
  const [doc5, alpha, beta, image, photo] = await upload(runtime, "member", [
    pdf("Five pages.pdf", five),
    pdf(
      "Alpha.pdf",
      await makePdf(["alpha 1", "alpha 2"], { width: 300, height: 400 }),
    ),
    pdf("Beta.pdf", await makePdf(["beta 1"], { width: 500, height: 500 })),
    png("Red square.png", makePng(40, 40, [200, 30, 30])),
    png("Wide photo.png", makePng(120, 60, [30, 90, 200])),
  ]);

  // F001: the workspace lists the member's own files with pages, size and expiry.
  expect(doc5.pageCount).toBe(5);
  expect(image.pageCount).toBe(null);
  expect(doc5.size).toBe(five.length);
  expect(doc5.expiresAt - doc5.createdAt).toBe(2 * 60 * 60 * 1000);
  const listed = await (
    await runtime.fetch("/api/files?sort=name-asc", { role: "member" })
  ).json();
  expect(listed.files.map((f) => f.name)).toEqual([
    "Alpha.pdf",
    "Beta.pdf",
    "Five pages.pdf",
    "Red square.png",
    "Wide photo.png",
  ]);
  const desc = await (
    await runtime.fetch("/api/files?sort=name-desc", { role: "member" })
  ).json();
  expect(desc.files[0].name).toBe("Wide photo.png");
  expect((await download(runtime, "member", doc5.id)).equals(five)).toBe(true);
  const bad = new FormData();
  bad.append("file", new Blob(["hello"], { type: "text/plain" }), "notes.txt");
  expect(
    (
      await runtime.fetch("/api/files", {
        role: "member",
        method: "POST",
        body: bad,
      })
    ).status,
  ).toBe(400);
  const [temp] = await upload(runtime, "member", [
    pdf("Temp.pdf", await makePdf(["t"])),
  ]);
  expect(
    (
      await runtime.fetch(`/api/files/${temp.id}`, {
        role: "member",
        method: "DELETE",
      })
    ).status,
  ).toBe(200);
  expect(
    (await runtime.fetch(`/api/files/${temp.id}`, { role: "member" })).status,
  ).toBe(404);

  // Files expire two hours after creation and the schedule deletes them.
  const [old] = await upload(runtime, "member", [
    pdf("Old.pdf", await makePdf(["old"])),
  ]);
  const db = await runtime.database();
  await db
    .prepare("update files set expires_at = ? where id = ?")
    .bind(Date.now() - 1000, old.id)
    .run();
  expect(
    (await runtime.fetch(`/api/files/${old.id}`, { role: "member" })).status,
  ).toBe(404);
  await runtime.scheduled("*/10 * * * *");
  expect(
    (
      await db
        .prepare("select count(*) as n from files where id = ?")
        .bind(old.id)
        .first()
    ).n,
  ).toBe(0);

  // F002: merge in the given order.
  const merged = await runTask(runtime, "member", {
    tool: "merge",
    inputs: [beta.id, alpha.id],
    options: {},
  });
  expect(merged.task.outputs).toHaveLength(1);
  const mergedText = await pageTexts(
    await download(runtime, "member", merged.task.outputs[0].id),
  );
  expect(mergedText).toEqual(["beta 1", "alpha 1", "alpha 2"]);
  await runTask(
    runtime,
    "member",
    { tool: "merge", inputs: [alpha.id], options: {} },
    400,
  );
  const fetched = await (
    await runtime.fetch(`/api/tasks/${merged.task.id}`, { role: "member" })
  ).json();
  expect(fetched.task.inputs.map((f) => f.id)).toEqual([beta.id, alpha.id]);

  // F003: split by ranges, merged ranges, fixed size, extract all and chosen pages.
  const ranges = await runTask(runtime, "member", {
    tool: "split",
    inputs: [doc5.id],
    options: {
      mode: "ranges",
      ranges: [
        { from: 1, to: 2 },
        { from: 4, to: 5 },
      ],
      mergeRanges: false,
    },
  });
  expect(ranges.task.outputs).toHaveLength(2);
  expect(
    await pageTexts(
      await download(runtime, "member", ranges.task.outputs[1].id),
    ),
  ).toEqual(["page four", "page five"]);
  const joined = await runTask(runtime, "member", {
    tool: "split",
    inputs: [doc5.id],
    options: {
      mode: "ranges",
      ranges: [
        { from: 1, to: 1 },
        { from: 3, to: 4 },
      ],
      mergeRanges: true,
    },
  });
  expect(joined.task.outputs).toHaveLength(1);
  expect(joined.task.outputs[0].pageCount).toBe(3);
  const fixed = await runTask(runtime, "member", {
    tool: "split",
    inputs: [doc5.id],
    options: { mode: "fixed", every: 2 },
  });
  expect(fixed.task.outputs.map((f) => f.pageCount)).toEqual([2, 2, 1]);
  const all = await runTask(runtime, "member", {
    tool: "split",
    inputs: [doc5.id],
    options: { mode: "extract", pages: "all" },
  });
  expect(all.task.outputs).toHaveLength(5);
  const some = await runTask(runtime, "member", {
    tool: "split",
    inputs: [doc5.id],
    options: { mode: "extract", pages: "2,4-5" },
  });
  expect(some.task.outputs).toHaveLength(3);
  expect(
    await pageTexts(await download(runtime, "member", some.task.outputs[0].id)),
  ).toEqual(["page two"]);
  const outside = await runTask(
    runtime,
    "member",
    {
      tool: "split",
      inputs: [doc5.id],
      options: {
        mode: "ranges",
        ranges: [{ from: 4, to: 9 }],
        mergeRanges: false,
      },
    },
    400,
  );
  expect(outside.error).toMatch(/5 pages/);

  // F004: reorder, insert a blank page, rotate, delete.
  const organized = await runTask(runtime, "member", {
    tool: "organize",
    inputs: [doc5.id],
    options: {
      pages: [
        { source: 3, rotate: 90 },
        { source: null, rotate: 0 },
        { source: 1, rotate: 180 },
      ],
    },
  });
  const orgBytes = await download(
    runtime,
    "member",
    organized.task.outputs[0].id,
  );
  expect(await pageTexts(orgBytes)).toEqual(["page three", "", "page one"]);
  const orgDoc = await loadPdf(orgBytes);
  expect(orgDoc.getPage(0).getRotation()).toEqual(degrees(90));
  expect(orgDoc.getPage(2).getRotation()).toEqual(degrees(180));
  await runTask(
    runtime,
    "member",
    { tool: "organize", inputs: [doc5.id], options: { pages: [] } },
    400,
  );

  // F005: compress reports sizes and the saving.
  const bulky = await makePdf(
    Array.from({ length: 40 }, (_, i) => `section ${i + 1}`),
    { objectStreams: false, title: "Quarterly figures" },
  );
  const [big] = await upload(runtime, "member", [
    pdf("Quarterly figures.pdf", bulky),
  ]);
  const compressed = await runTask(runtime, "member", {
    tool: "compress",
    inputs: [big.id],
    options: { level: "strong" },
  });
  expect(compressed.task.result.originalSize).toBe(bulky.length);
  expect(compressed.task.result.newSize).toBeLessThan(bulky.length);
  expect(compressed.task.result.savedPercent).toBeGreaterThan(0);
  expect(
    (await download(runtime, "member", compressed.task.outputs[0].id)).length,
  ).toBe(compressed.task.result.newSize);
  expect(
    (
      await pageTexts(
        await download(runtime, "member", compressed.task.outputs[0].id),
      )
    )[39],
  ).toBe("section 40");

  // F006: text watermark on a page range, image watermark tiled under the content.
  const wm = await runTask(runtime, "member", {
    tool: "watermark",
    inputs: [doc5.id],
    options: {
      type: "text",
      text: "CONFIDENTIAL",
      fontSize: 40,
      color: "#cc0000",
      opacity: 0.4,
      rotation: 45,
      position: "middle-center",
      from: 2,
      to: 3,
      layer: "over",
    },
  });
  const wmText = await pageTexts(
    await download(runtime, "member", wm.task.outputs[0].id),
  );
  expect(wmText[0]).not.toContain("CONFIDENTIAL");
  expect(wmText[1]).toContain("CONFIDENTIAL");
  expect(wmText[2]).toContain("CONFIDENTIAL");
  expect(wmText[3]).not.toContain("CONFIDENTIAL");
  const wmImage = await runTask(runtime, "member", {
    tool: "watermark",
    inputs: [doc5.id],
    options: {
      type: "image",
      imageId: image.id,
      opacity: 0.3,
      rotation: 0,
      position: "tiled",
      layer: "under",
    },
  });
  expect(wmImage.task.outputs[0].pageCount).toBe(5);
  expect(wmImage.task.outputs[0].size).toBeGreaterThan(doc5.size);

  // F007: page numbers with a cover page and a total.
  const numbered = await runTask(runtime, "member", {
    tool: "page-numbers",
    inputs: [doc5.id],
    options: {
      vertical: "bottom",
      horizontal: "center",
      margin: "medium",
      start: 1,
      skipFirst: true,
      template: "page-n-of-p",
      fontSize: 12,
    },
  });
  const numText = await pageTexts(
    await download(runtime, "member", numbered.task.outputs[0].id),
  );
  expect(numText[0]).not.toContain("Page");
  expect(numText[1]).toContain("Page 1 of 4");
  expect(numText[4]).toContain("Page 4 of 4");
  const custom = await runTask(runtime, "member", {
    tool: "page-numbers",
    inputs: [doc5.id],
    options: {
      vertical: "top",
      horizontal: "right",
      margin: "small",
      start: 10,
      from: 2,
      to: 3,
      skipFirst: false,
      template: "custom",
      custom: "Sheet {n}",
      fontSize: 10,
    },
  });
  const customText = await pageTexts(
    await download(runtime, "member", custom.task.outputs[0].id),
  );
  expect(customText[0]).not.toContain("Sheet");
  expect(customText[1]).toContain("Sheet 10");
  expect(customText[2]).toContain("Sheet 11");

  // F008: images to one PDF on A4 landscape, or one PDF per image fitted to the image.
  const oneFile = await runTask(runtime, "member", {
    tool: "images-to-pdf",
    inputs: [photo.id, image.id],
    options: {
      pageSize: "a4",
      orientation: "landscape",
      margin: "small",
      oneFile: true,
    },
  });
  expect(oneFile.task.outputs).toHaveLength(1);
  const a4 = await loadPdf(
    await download(runtime, "member", oneFile.task.outputs[0].id),
  );
  expect(a4.getPageCount()).toBe(2);
  expect(Math.round(a4.getPage(0).getWidth())).toBe(842);
  const each = await runTask(runtime, "member", {
    tool: "images-to-pdf",
    inputs: [photo.id, image.id],
    options: {
      pageSize: "fit",
      orientation: "portrait",
      margin: "none",
      oneFile: false,
    },
  });
  expect(each.task.outputs).toHaveLength(2);
  const fit = await loadPdf(
    await download(runtime, "member", each.task.outputs[0].id),
  );
  expect(fit.getPage(0).getSize()).toEqual({ width: 120, height: 60 });
  await runTask(
    runtime,
    "member",
    {
      tool: "images-to-pdf",
      inputs: [doc5.id],
      options: {
        pageSize: "fit",
        orientation: "portrait",
        margin: "none",
        oneFile: true,
      },
    },
    400,
  );

  // The browser journey, as a member with a fresh set of documents.
  const context = await runtime.context("member");
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await runtime.assertBackLink(page);
  await page.getByTestId("upload-input").setInputFiles([
    {
      name: "Board pack - March.pdf",
      mimeType: "application/pdf",
      buffer: await makePdf(["Board pack", "Agenda", "Minutes"]),
    },
    {
      name: "Annual budget 2027.pdf",
      mimeType: "application/pdf",
      buffer: await makePdf(["Budget summary", "Operating costs"]),
    },
    {
      name: "Cover letter.pdf",
      mimeType: "application/pdf",
      buffer: await makePdf(["Dear shareholders"]),
    },
  ]);
  await expect(
    page.getByTestId("file-row").filter({ hasText: "Cover letter.pdf" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("file-row").filter({ hasText: "Board pack - March.pdf" }),
  ).toContainText("3");

  // F004 in the browser: thumbnails, rotate one page, delete one, save.
  await page.goto("/tools/organize");
  await page.getByRole("checkbox", { name: "Board pack - March.pdf" }).click();
  await expect(page.getByTestId("page-thumb")).toHaveCount(3);
  await expect(
    page.getByTestId("page-thumb").first().locator("canvas"),
  ).toBeVisible();
  await page
    .getByTestId("page-thumb")
    .nth(0)
    .getByRole("button", { name: "Rotate page" })
    .click();
  await page
    .getByTestId("page-thumb")
    .nth(1)
    .getByRole("button", { name: "Delete page" })
    .click();
  await expect(page.getByTestId("page-thumb")).toHaveCount(2);
  await page.getByTestId("run-task").click();
  await expect(page).toHaveURL(/\/tasks\//);
  const orgId = await page
    .getByTestId("task-output")
    .first()
    .getAttribute("data-file-id");
  const browserOrg = await loadPdf(await download(runtime, "member", orgId));
  expect(browserOrg.getPageCount()).toBe(2);
  expect(browserOrg.getPage(0).getRotation()).toEqual(degrees(90));

  // F008 in the browser: each page of a PDF becomes a JPG.
  await page.goto("/tools/pdf-to-images");
  await page.getByRole("checkbox", { name: "Annual budget 2027.pdf" }).click();
  await page.getByTestId("run-task").click();
  await expect(page).toHaveURL(/\/tasks\//, { timeout: 30000 });
  await expect(page.getByTestId("task-output")).toHaveCount(2);
  await expect(page.getByTestId("task-output").first()).toContainText(".jpg");

  // F002 in the browser: pick three files, sort by name, move one, merge.
  await page.goto("/tools/merge");
  for (const name of [
    "Cover letter.pdf",
    "Board pack - March.pdf",
    "Annual budget 2027.pdf",
  ]) {
    await page.getByRole("checkbox", { name }).click();
  }
  await page.getByTestId("sort-desc").click();
  await expect(page.getByTestId("selected-file").first()).toContainText(
    "Cover letter.pdf",
  );
  await page
    .getByTestId("selected-file")
    .nth(2)
    .getByRole("button", { name: "Move up" })
    .click();
  await expect(page.getByTestId("selected-file").nth(1)).toContainText(
    "Annual budget 2027.pdf",
  );
  await page.getByTestId("run-task").click();
  await expect(page).toHaveURL(/\/tasks\//);
  await expect(page.getByTestId("task-output")).toHaveCount(1);
  await expect(page.getByTestId("task-output")).toContainText("6 pages");
  const mergedId = await page
    .getByTestId("task-output")
    .getAttribute("data-file-id");
  expect(await pageTexts(await download(runtime, "member", mergedId))).toEqual([
    "Dear shareholders",
    "Budget summary",
    "Operating costs",
    "Board pack",
    "Agenda",
    "Minutes",
  ]);
  await expect(page.getByTestId("pdf-preview").locator("canvas")).toHaveCount(6);
  await runtime.assertBackLink(page);
  await runtime.screenshot(page);
  await context.close();

  // Phone-sized smoke.
  const phone = await runtime.context("member", {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const small = await phone.newPage();
  await small.goto("/");
  await expect(small.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(small.getByTestId("file-row").first()).toBeVisible();
  expect(
    await small.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await small.goto("/tools");
  await expect(small.getByRole("link", { name: /Merge/ })).toBeVisible();
  await phone.close();
  console.log("behavior: ok");
} finally {
  await runtime.close();
}
