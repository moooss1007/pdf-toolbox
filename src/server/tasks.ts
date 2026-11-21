import { and, asc, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { files, tasks, type TaskInput, type TaskResult } from "@/db/schema";
import { NotFoundError, PdfInputError } from "./errors";
import {
  FILE_LIFETIME_MS,
  MAX_FILE_BYTES,
  getFiles,
  readBytes,
  sniff,
  storeFile,
  toRecord,
  type FileRecord,
  type NewFile,
} from "./files";
import * as ops from "./pdf/ops";

const TOOLS = [
  "merge",
  "split",
  "organize",
  "compress",
  "watermark",
  "page-numbers",
  "images-to-pdf",
  "pdf-to-images",
] as const;
type Tool = (typeof TOOLS)[number];

const ids = z.array(z.string().min(1).max(64)).max(100);

export const runTaskInput = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("merge"),
    inputs: ids,
    options: z.object({}).passthrough(),
  }),
  z.object({
    tool: z.literal("split"),
    inputs: ids,
    options: ops.splitOptions,
  }),
  z.object({
    tool: z.literal("organize"),
    inputs: ids,
    options: ops.organizeOptions,
  }),
  z.object({
    tool: z.literal("compress"),
    inputs: ids,
    options: ops.compressOptions,
  }),
  z.object({
    tool: z.literal("watermark"),
    inputs: ids,
    options: ops.watermarkOptions,
  }),
  z.object({
    tool: z.literal("page-numbers"),
    inputs: ids,
    options: ops.pageNumberOptions,
  }),
  z.object({
    tool: z.literal("images-to-pdf"),
    inputs: ids,
    options: ops.imagesToPdfOptions,
  }),
]);
export type RunTaskInput = z.infer<typeof runTaskInput>;

interface TaskView {
  id: string;
  tool: string;
  inputs: TaskInput[];
  options: unknown;
  result: TaskResult | null;
  createdAt: number;
  expiresAt: number;
  outputs: FileRecord[];
}

type Loaded = Awaited<ReturnType<typeof getFiles>>[number];

async function loadPdf(file: Loaded) {
  if (file.kind !== "pdf") throw new PdfInputError(`${file.name} is not a PDF`);
  return { name: file.name, bytes: await readBytes(file) };
}

function single(inputs: Loaded[]): Loaded {
  if (inputs.length !== 1) throw new PdfInputError("Choose one PDF");
  return inputs[0]!;
}

const pdfOut = (doc: ops.OutputDoc): NewFile => ({
  name: doc.name,
  bytes: doc.bytes,
  kind: "pdf",
  mime: "application/pdf",
  pageCount: doc.pageCount,
});

/** Runs a tool on the member's own files and records the task with its outputs. */
export async function runTask(
  ownerId: string,
  input: RunTaskInput,
): Promise<TaskView> {
  const inputs = await getFiles(ownerId, input.inputs);
  let outputs: NewFile[];
  let result: TaskResult | null = null;
  switch (input.tool) {
    case "merge": {
      if (inputs.length < 2)
        throw new PdfInputError("Choose at least two PDFs");
      const docs = [];
      for (const file of inputs) docs.push(await loadPdf(file));
      outputs = [pdfOut(await ops.merge(docs))];
      break;
    }
    case "split":
      outputs = (
        await ops.split(await loadPdf(single(inputs)), input.options)
      ).map(pdfOut);
      break;
    case "organize":
      outputs = [
        pdfOut(
          await ops.organize(await loadPdf(single(inputs)), input.options),
        ),
      ];
      break;
    case "compress": {
      const done = await ops.compress(
        await loadPdf(single(inputs)),
        input.options,
      );
      outputs = [pdfOut(done.output)];
      result = {
        originalSize: done.originalSize,
        newSize: done.newSize,
        savedPercent: done.savedPercent,
        reduced: done.reduced,
      };
      break;
    }
    case "watermark": {
      const source = await loadPdf(single(inputs));
      let image: { bytes: Uint8Array; mime: string } | undefined;
      if (input.options.type === "image") {
        const [stamp] = await getFiles(ownerId, [input.options.imageId]);
        if (stamp!.kind !== "image")
          throw new PdfInputError("The watermark must be a JPG or PNG");
        image = { bytes: await readBytes(stamp!), mime: stamp!.mime };
      }
      outputs = [pdfOut(await ops.watermark(source, input.options, image))];
      break;
    }
    case "page-numbers":
      outputs = [
        pdfOut(
          await ops.addPageNumbers(
            await loadPdf(single(inputs)),
            input.options,
          ),
        ),
      ];
      break;
    case "images-to-pdf": {
      const images = [];
      for (const file of inputs) {
        if (file.kind !== "image")
          throw new PdfInputError(`${file.name} is not a JPG or PNG`);
        images.push({
          name: file.name,
          mime: file.mime,
          bytes: await readBytes(file),
        });
      }
      outputs = (await ops.imagesToPdf(images, input.options)).map(pdfOut);
      break;
    }
  }
  return recordTask(
    ownerId,
    input.tool,
    inputs,
    input.options,
    outputs,
    result,
  );
}

/** Saves page images a member's browser rendered from one of their PDFs. */
export async function savePageImages(
  ownerId: string,
  sourceId: string,
  images: { name: string; bytes: Uint8Array }[],
): Promise<TaskView> {
  const [source] = await getFiles(ownerId, [sourceId]);
  if (source!.kind !== "pdf")
    throw new PdfInputError(`${source!.name} is not a PDF`);
  if (images.length !== source!.pageCount) {
    throw new PdfInputError(
      `Expected ${source!.pageCount} page images, got ${images.length}`,
    );
  }
  const base = source!.name.replace(/\.pdf$/i, "");
  const outputs: NewFile[] = images.map((image, index) => {
    if (
      image.bytes.length > MAX_FILE_BYTES ||
      sniff(image.bytes)?.mime !== "image/jpeg"
    ) {
      throw new PdfInputError("Each page must be a JPG under 50 MB");
    }
    return {
      name: `${base}-page-${index + 1}.jpg`,
      bytes: image.bytes,
      kind: "image",
      mime: "image/jpeg",
      pageCount: null,
    };
  });
  return recordTask(ownerId, "pdf-to-images", [source!], {}, outputs, null);
}

async function recordTask(
  ownerId: string,
  tool: Tool,
  inputs: Loaded[],
  options: unknown,
  outputs: NewFile[],
  result: TaskResult | null,
): Promise<TaskView> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const rows = [];
  for (const [position, output] of outputs.entries()) {
    rows.push({ ...(await storeFile(ownerId, output, id, now)), position });
  }
  const task = {
    id,
    ownerId,
    tool,
    inputs: inputs.map((f) => ({ id: f.id, name: f.name })),
    options,
    result,
    createdAt: now,
    expiresAt: now + FILE_LIFETIME_MS,
  };
  // D1 has no interactive transactions: the task and its outputs go in one batch.
  const statements = [
    db.insert(tasks).values(task),
    ...chunk(rows, 10).map((part) => db.insert(files).values(part)),
  ];
  await db.batch(statements as [(typeof statements)[0], ...typeof statements]);
  return {
    id,
    tool,
    inputs: task.inputs,
    options,
    result,
    createdAt: now,
    expiresAt: task.expiresAt,
    outputs: rows.map(toRecord),
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    parts.push(items.slice(i, i + size));
  return parts;
}

export async function getTask(ownerId: string, id: string): Promise<TaskView> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.id, id),
        eq(tasks.ownerId, ownerId),
        gt(tasks.expiresAt, Date.now()),
      ),
    );
  if (!task) throw new NotFoundError("Task not found");
  const outputs = await db
    .select({
      id: files.id,
      name: files.name,
      kind: files.kind,
      mime: files.mime,
      size: files.size,
      pageCount: files.pageCount,
      taskId: files.taskId,
      createdAt: files.createdAt,
      expiresAt: files.expiresAt,
    })
    .from(files)
    .where(
      and(
        eq(files.taskId, id),
        eq(files.ownerId, ownerId),
        gt(files.expiresAt, Date.now()),
      ),
    )
    .orderBy(asc(files.position));
  return {
    id: task.id,
    tool: task.tool,
    inputs: task.inputs,
    options: task.options,
    result: task.result ?? null,
    createdAt: task.createdAt,
    expiresAt: task.expiresAt,
    outputs,
  };
}

export async function listTasks(ownerId: string) {
  const rows = await db
    .select({
      id: tasks.id,
      tool: tasks.tool,
      inputs: tasks.inputs,
      createdAt: tasks.createdAt,
      expiresAt: tasks.expiresAt,
    })
    .from(tasks)
    .where(and(eq(tasks.ownerId, ownerId), gt(tasks.expiresAt, Date.now())))
    .orderBy(desc(tasks.createdAt))
    .limit(200);
  return rows;
}
