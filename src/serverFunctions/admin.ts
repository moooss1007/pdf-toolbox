import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as files from "@/server/files";

/** Workspace totals, or null for a member who isn't an admin. */
export const getAdminStats = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context }) => (isAdmin(context.user) ? files.totals() : null));

export const purgeExpiredNow = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    if (!isAdmin(context.user))
      throw new Error("Only workspace admins can do this");
    return { deleted: await files.purgeExpired() };
  });
