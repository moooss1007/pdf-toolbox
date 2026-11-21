import { createFileRoute } from "@tanstack/react-router";
import { deleteFile, getFile, openFile } from "@/server/files";
import { withUser } from "@/server/requestUser";

// One of the member's files: download it, or delete it.
export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        withUser(request, async (user) => {
          const file = await getFile(user.id, params.id);
          const object = await openFile(file);
          const inline = new URL(request.url).searchParams.has("inline");
          return new Response(object.body, {
            headers: {
              "content-type": file.mime,
              "content-length": String(file.size),
              "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
              "cache-control": "private, no-store",
              "x-content-type-options": "nosniff",
            },
          });
        }),
      DELETE: ({ request, params }) =>
        withUser(request, async (user) => {
          await deleteFile(user.id, params.id);
          return Response.json({ ok: true });
        }),
    },
  },
});
