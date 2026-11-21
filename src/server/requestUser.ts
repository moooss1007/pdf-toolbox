import {
  getEveryAppUser,
  isAdmin,
  type EveryAppUser,
} from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { errorResponse } from "./errors";
import { rememberUser } from "./files";

/**
 * Runs an API handler for the member the Gateway signed in (a browser
 * session or a personal access token). Every route here is private, so a
 * missing user only happens on a misrouted request.
 */
export async function withUser(
  request: Request,
  handle: (user: EveryAppUser) => Promise<Response>,
  { admin = false } = {},
): Promise<Response> {
  const user = await getEveryAppUser(request, env);
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (admin && !isAdmin(user)) {
    return Response.json(
      { error: "Only workspace admins can do this" },
      { status: 403 },
    );
  }
  try {
    await rememberUser(user);
    return await handle(user);
  } catch (error) {
    return errorResponse(error);
  }
}

/** The uploaded files of a multipart form field. */
export async function formFiles(form: FormData, field: string) {
  const uploads = [];
  for (const value of form.getAll(field)) {
    if (typeof value === "string") continue;
    uploads.push({
      name: value.name,
      bytes: new Uint8Array(await value.arrayBuffer()),
    });
  }
  return uploads;
}
