import { createFileRoute } from "@tanstack/react-router";
import { PdfInputError } from "@/server/errors";
import { listTasks, runTask, runTaskInput } from "@/server/tasks";
import { withUser } from "@/server/requestUser";

// The member's tasks: list them, or run a tool on their files (JSON).
export const Route = createFileRoute("/api/tasks")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withUser(request, async (user) =>
          Response.json({ tasks: await listTasks(user.id) }),
        ),
      POST: ({ request }) =>
        withUser(request, async (user) => {
          const body = await request.json().catch(() => {
            throw new PdfInputError("Send a JSON body");
          });
          const task = await runTask(user.id, runTaskInput.parse(body));
          return Response.json({ task }, { status: 201 });
        }),
    },
  },
});
