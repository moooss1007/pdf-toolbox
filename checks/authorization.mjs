// Authorization: private paths, per-member files and tasks, admin-only actions, no sign-in of its own.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { makePdf, upload, runTask, pdf } from "./lib.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess([
    "/",
    "/tools",
    "/tools/merge",
    "/tasks",
    "/api/files",
    "/api/tasks",
  ]);

  const [mine, other] = await upload(runtime, "member", [
    pdf("Contract draft.pdf", await makePdf(["contract", "terms"])),
    pdf("Invoice.pdf", await makePdf(["invoice"])),
  ]);
  const task = await runTask(runtime, "member", {
    tool: "merge",
    inputs: [mine.id, other.id],
    options: {},
  });
  const outputId = task.task.outputs[0].id;

  // Anonymous and outsider callers reach nothing.
  for (const role of [undefined, "outsider"]) {
    expect([401, 403]).toContain(
      (await runtime.fetch(`/api/files/${mine.id}`, { role })).status,
    );
    expect([401, 403]).toContain(
      (await runtime.fetch(`/api/tasks/${task.task.id}`, { role })).status,
    );
    const form = new FormData();
    form.append(
      "file",
      new Blob([await makePdf(["x"])], { type: "application/pdf" }),
      "x.pdf",
    );
    expect([401, 403]).toContain(
      (await runtime.fetch("/api/files", { role, method: "POST", body: form }))
        .status,
    );
  }

  // Another member of the same organization (the owner) can't see, use or delete the member's files.
  const ownerList = await (
    await runtime.fetch("/api/files", { role: "owner" })
  ).json();
  expect(ownerList.files).toEqual([]);
  expect(
    (await runtime.fetch(`/api/files/${mine.id}`, { role: "owner" })).status,
  ).toBe(404);
  expect(
    (await runtime.fetch(`/api/files/${outputId}`, { role: "owner" })).status,
  ).toBe(404);
  expect(
    (
      await runtime.fetch(`/api/files/${mine.id}`, {
        role: "owner",
        method: "DELETE",
      })
    ).status,
  ).toBe(404);
  expect(
    (await runtime.fetch(`/api/tasks/${task.task.id}`, { role: "owner" }))
      .status,
  ).toBe(404);
  const ownerTasks = await (
    await runtime.fetch("/api/tasks", { role: "owner" })
  ).json();
  expect(ownerTasks.tasks).toEqual([]);
  const [ownerFile] = await upload(runtime, "owner", [
    pdf("Owner notes.pdf", await makePdf(["owner"])),
  ]);
  const stolen = await runTask(
    runtime,
    "owner",
    { tool: "merge", inputs: [ownerFile.id, mine.id], options: {} },
    404,
  );
  expect(stolen.error).toBeTruthy();
  await runTask(
    runtime,
    "owner",
    { tool: "split", inputs: [mine.id], options: { mode: "fixed", every: 1 } },
    404,
  );
  // The member's file survived the attempts.
  expect(
    (await runtime.fetch(`/api/files/${mine.id}`, { role: "member" })).status,
  ).toBe(200);
  expect(
    (await runtime.fetch(`/api/files/${ownerFile.id}`, { role: "member" }))
      .status,
  ).toBe(404);

  // In the browser, another member's task page shows nothing of it.
  const ownerContext = await runtime.context("owner");
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto(`/tasks/${task.task.id}`);
  await expect(ownerPage.getByText("Contract draft.pdf")).toHaveCount(0);
  await expect(ownerPage.getByTestId("task-not-found")).toBeVisible();
  await ownerPage.goto("/");
  await expect(ownerPage.getByText("Contract draft.pdf")).toHaveCount(0);
  await expect(
    ownerPage.getByTestId("file-row").filter({ hasText: "Owner notes.pdf" }),
  ).toBeVisible();

  // Admin-only: totals and purging expired files.
  expect(
    (await runtime.fetch("/api/admin/stats", { role: "member" })).status,
  ).toBe(403);
  expect(
    (
      await runtime.fetch("/api/admin/purge", {
        role: "member",
        method: "POST",
      })
    ).status,
  ).toBe(403);
  const stats = await runtime.fetch("/api/admin/stats", { role: "owner" });
  expect(stats.status).toBe(200);
  const body = await stats.json();
  expect(body.files).toBeGreaterThanOrEqual(4);
  expect(JSON.stringify(body)).not.toContain("Contract draft.pdf");
  expect(
    (await runtime.fetch("/api/admin/purge", { role: "owner", method: "POST" }))
      .status,
  ).toBe(200);
  await ownerPage.goto("/admin");
  await expect(ownerPage.getByTestId("admin-stats")).toBeVisible();
  await ownerContext.close();
  const memberContext = await runtime.context("member");
  const memberPage = await memberContext.newPage();
  await memberPage.goto("/admin");
  await expect(memberPage.getByTestId("admin-refused")).toBeVisible();
  await expect(memberPage.getByTestId("admin-stats")).toHaveCount(0);
  await memberContext.close();

  // No sign-in of its own.
  for (const path of [
    "/login",
    "/signin",
    "/sign-in",
    "/signup",
    "/register",
  ]) {
    const response = await runtime.fetch(path, { role: "member" });
    const text = await response.text();
    expect(text).not.toMatch(/type="password"/);
    expect(response.status).toBe(404);
  }
  const home = await (await runtime.fetch("/", { role: "member" })).text();
  expect(home).not.toMatch(/type="password"|Sign in|Log in/i);
  console.log("authorization: ok");
} finally {
  await runtime.close();
}
