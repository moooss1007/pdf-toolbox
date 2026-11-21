import { createFileRoute } from "@tanstack/react-router";
import { purgeExpired } from "@/server/files";
import { withUser } from "@/server/requestUser";

// Deletes expired files now instead of at the next scheduled run. Admins only.
export const Route = createFileRoute("/api/admin/purge")({
  server: {
    handlers: {
      POST: ({ request }) =>
        withUser(
          request,
          async () => Response.json({ deleted: await purgeExpired() }),
          { admin: true },
        ),
    },
  },
});
