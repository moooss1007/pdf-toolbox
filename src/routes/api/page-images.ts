import { createFileRoute } from "@tanstack/react-router";
import { PdfInputError } from "@/server/errors";
import { savePageImages } from "@/server/tasks";
import { formFiles, withUser } from "@/server/requestUser";

// The page images the browser rendered from one of the member's PDFs
// (multipart: "source" is the PDF's id, "image" each page's JPG in order).
export const Route = createFileRoute("/api/page-images")({
  server: {
    handlers: {
      POST: ({ request }) =>
        withUser(request, async (user) => {
          const form = await request.formData().catch(() => {
            throw new PdfInputError("Send the images as multipart form data");
          });
          const source = form.get("source");
          if (typeof source !== "string")
            throw new PdfInputError("Choose a PDF");
          const task = await savePageImages(
            user.id,
            source,
            await formFiles(form, "image"),
          );
          return Response.json({ task }, { status: 201 });
        }),
    },
  },
});
