import { createFileRoute } from "@tanstack/react-router";
import { totals } from "@/server/files";
import { withUser } from "@/server/requestUser";

// Workspace totals for admins: counts and bytes, never names or contents.
export const Route = createFileRoute("/api/admin/stats")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withUser(request, async () => Response.json(await totals()), {
          admin: true,
        }),
    },
  },
});
