import { PdfInputError } from "./pdf/pages";

/** No file or task of this member has the id (or it has expired). */
export class NotFoundError extends Error {}

export { PdfInputError };

/** A JSON error response for the API routes. */
export function errorResponse(error: unknown): Response {
  if (error instanceof NotFoundError) {
    return Response.json(
      { error: error.message || "Not found" },
      { status: 404 },
    );
  }
  if (error instanceof PdfInputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return Response.json(
      { error: issues.map((i) => i.message).join("; ") || "Invalid request" },
      { status: 400 },
    );
  }
  console.error(error);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
