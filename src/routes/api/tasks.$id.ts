import { createFileRoute } from "@tanstack/react-router";
import { getTask } from "@/server/tasks";
import { withUser } from "@/server/requestUser";

export const Route = createFileRoute("/api/tasks/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        withUser(request, async (user) =>
          Response.json({ task: await getTask(user.id, params.id) }),
        ),
    },
  },
});
