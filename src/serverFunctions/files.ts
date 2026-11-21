import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as files from "@/server/files";

// Each server function runs behind ensureUserMiddleware: `context.user` is
// the member the Gateway signed in, and every query takes their id.
export const getFiles = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        sort: z.enum(["newest", "name-asc", "name-desc"]).default("newest"),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await files.rememberUser(context.user);
    return files.listFiles(context.user.id, data.sort);
  });

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    await files.deleteFile(context.user.id, data.id);
    return { ok: true };
  });
