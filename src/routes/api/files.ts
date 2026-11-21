import { createFileRoute } from "@tanstack/react-router";
import { PdfInputError } from "@/server/errors";
import { listFiles, uploadFiles, type FileSort } from "@/server/files";
import { formFiles, withUser } from "@/server/requestUser";

const SORTS: FileSort[] = ["newest", "name-asc", "name-desc"];

// The member's files: list them, or upload PDFs and images (multipart, field "file").
export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withUser(request, async (user) => {
          const sort = new URL(request.url).searchParams.get(
            "sort",
          ) as FileSort;
          const files = await listFiles(
            user.id,
            SORTS.includes(sort) ? sort : "newest",
          );
          return Response.json({ files });
        }),
      POST: ({ request }) =>
        withUser(request, async (user) => {
          let form: FormData;
          try {
            form = await request.formData();
          } catch {
            throw new PdfInputError("Send the files as multipart form data");
          }
          const files = await uploadFiles(
            user.id,
            await formFiles(form, "file"),
          );
          return Response.json({ files }, { status: 201 });
        }),
    },
  },
});
