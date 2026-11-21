// Persistence: files and tasks survive a restart.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { makePdf, upload, runTask, download, pageTexts, pdf } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const [a, b] = await upload(runtime, "member", [
    pdf("Lease part 1.pdf", await makePdf(["lease one"])),
    pdf("Lease part 2.pdf", await makePdf(["lease two"])),
  ]);
  const { task } = await runTask(runtime, "member", {
    tool: "merge",
    inputs: [a.id, b.id],
    options: {},
  });
  await runtime.restart();
  const list = await (
    await runtime.fetch("/api/files?sort=name-asc", { role: "member" })
  ).json();
  expect(list.files.map((f) => f.name)).toContain("Lease part 1.pdf");
  expect(list.files.find((f) => f.id === task.outputs[0].id)).toBeTruthy();
  const again = await (
    await runtime.fetch(`/api/tasks/${task.id}`, { role: "member" })
  ).json();
  expect(again.task.outputs[0].id).toBe(task.outputs[0].id);
  expect(
    await pageTexts(await download(runtime, "member", task.outputs[0].id)),
  ).toEqual(["lease one", "lease two"]);
  console.log("persistence: ok");
} finally {
  await runtime.close();
}
