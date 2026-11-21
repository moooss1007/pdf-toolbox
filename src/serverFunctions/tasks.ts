import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { NotFoundError, PdfInputError } from "@/server/errors";
import * as tasks from "@/server/tasks";

/** Runs a tool. A problem the member can fix comes back as `error`. */
export const runTask = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => tasks.runTaskInput.parse(data))
  .handler(async ({ data, context }) => {
    try {
      const task = await tasks.runTask(context.user.id, data);
      return { taskId: task.id, error: null };
    } catch (error) {
      if (error instanceof PdfInputError || error instanceof NotFoundError) {
        return { taskId: null, error: error.message };
      }
      throw error;
    }
  });

/** The task, or null when the member has no live task with this id. */
export const getTask = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      const task = await tasks.getTask(context.user.id, data.id);
      return { ...task, options: JSON.stringify(task.options) };
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  });

export const getTasks = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => tasks.listTasks(context.user.id));
