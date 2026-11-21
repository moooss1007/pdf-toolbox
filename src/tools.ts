// The app's tools for AI clients. The Gateway serves them at /mcp and calls
// each with the signed-in user; every call works on that member's files only.
import { ToolError, defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { NotFoundError, PdfInputError } from "@/server/errors";
import * as files from "@/server/files";
import * as tasks from "@/server/tasks";

export const tools = defineTools(
  {
    list_files: {
      description:
        "List the user's uploaded and generated files (PDFs and images), newest first. Files are deleted two hours after they were made.",
      risk: "read",
      input: z.object({}).strict(),
      handler: (_input, { user }) => files.listFiles(user.id),
    },
    run_tool: {
      description:
        "Run a PDF tool (merge, split, organize, compress, watermark, page-numbers, images-to-pdf) on the user's files by id. Returns the task with its output files.",
      risk: "write",
      idempotent: false,
      input: tasks.runTaskInput,
      handler: (input, { user }) =>
        explain(() => tasks.runTask(user.id, input)),
    },
    get_task: {
      description: "A task's inputs, result and output files.",
      risk: "read",
      input: z.object({ id: z.string() }).strict(),
      handler: (input, { user }) =>
        explain(() => tasks.getTask(user.id, input.id)),
    },
    delete_file: {
      description: "Delete one of the user's files now.",
      risk: "write",
      destructive: true,
      input: z.object({ id: z.string() }).strict(),
      handler: (input, { user }) =>
        explain(async () => {
          await files.deleteFile(user.id, input.id);
          return { deleted: input.id };
        }),
    },
  },
  {
    instructions: "Never guess file ids: call list_files first.",
  },
);

/** Errors the model may read; any other error reaches it as "Internal error". */
async function explain<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof PdfInputError) {
      throw new ToolError(error.message);
    }
    throw error;
  }
}
