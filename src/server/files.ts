import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { db } from "@/db";
import { files, tasks, users } from "@/db/schema";
import { NotFoundError, PdfInputError } from "./errors";
import { openPdf } from "./pdf/ops";

/** Every uploaded and generated file is deleted this long after it was made. */
export const FILE_LIFETIME_MS = 2 * 60 * 60 * 1000;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 20;

export interface FileRecord {
  id: string;
  name: string;
  kind: "pdf" | "image";
  mime: string;
  size: number;
  pageCount: number | null;
  taskId: string | null;
  createdAt: number;
  expiresAt: number;
}

const shown = {
  id: files.id,
  name: files.name,
  kind: files.kind,
  mime: files.mime,
  size: files.size,
  pageCount: files.pageCount,
  taskId: files.taskId,
  createdAt: files.createdAt,
  expiresAt: files.expiresAt,
};

export type FileSort = "newest" | "name-asc" | "name-desc";

/** Records the member on first sight, keyed by the Gateway's user id. */
export async function rememberUser(user: {
  id: string;
  email: string;
}): Promise<void> {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email, createdAt: Date.now() })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}

export function listFiles(
  ownerId: string,
  sort: FileSort = "newest",
): Promise<FileRecord[]> {
  const order =
    sort === "name-asc"
      ? [asc(sql`lower(${files.name})`), asc(files.id)]
      : sort === "name-desc"
        ? [desc(sql`lower(${files.name})`), desc(files.id)]
        : [desc(files.createdAt), asc(files.name)];
  return db
    .select(shown)
    .from(files)
    .where(and(eq(files.ownerId, ownerId), gt(files.expiresAt, Date.now())))
    .orderBy(...order);
}

/** The member's live file, or NotFoundError. */
export async function getFile(
  ownerId: string,
  id: string,
): Promise<FileRecord & { storageKey: string }> {
  const [file] = await db
    .select({ ...shown, storageKey: files.storageKey })
    .from(files)
    .where(
      and(
        eq(files.id, id),
        eq(files.ownerId, ownerId),
        gt(files.expiresAt, Date.now()),
      ),
    );
  if (!file) throw new NotFoundError("File not found");
  return file;
}

/** The member's live files in the order asked for; any missing one is NotFoundError. */
export async function getFiles(ownerId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ ...shown, storageKey: files.storageKey })
    .from(files)
    .where(
      and(
        inArray(files.id, ids),
        eq(files.ownerId, ownerId),
        gt(files.expiresAt, Date.now()),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => {
    const row = byId.get(id);
    if (!row) throw new NotFoundError("File not found");
    return row;
  });
}

export async function readBytes(file: {
  storageKey: string;
}): Promise<Uint8Array> {
  const object = await env.files.get(file.storageKey);
  if (!object) throw new NotFoundError("File not found");
  return new Uint8Array(await object.arrayBuffer());
}

export async function openFile(file: { storageKey: string }) {
  const object = await env.files.get(file.storageKey);
  if (!object) throw new NotFoundError("File not found");
  return object;
}

/** What a file is from its first bytes, never from what the client claims. */
export function sniff(
  bytes: Uint8Array,
): { kind: "pdf" | "image"; mime: string } | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d]))
    return { kind: "pdf", mime: "application/pdf" };
  if (starts([0x89, 0x50, 0x4e, 0x47]))
    return { kind: "image", mime: "image/png" };
  if (starts([0xff, 0xd8, 0xff])) return { kind: "image", mime: "image/jpeg" };
  return null;
}

function cleanName(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .trim()
    .slice(0, 200);
  return cleaned || fallback;
}

export interface NewFile {
  name: string;
  bytes: Uint8Array;
  kind: "pdf" | "image";
  mime: string;
  pageCount: number | null;
}

/** Stores the bytes and returns the row to insert, so callers can batch it. */
export async function storeFile(
  ownerId: string,
  file: NewFile,
  taskId: string | null,
  now: number,
) {
  const id = crypto.randomUUID();
  const storageKey = `${ownerId}/${id}`;
  await env.files.put(storageKey, file.bytes, {
    httpMetadata: { contentType: file.mime },
  });
  return {
    id,
    ownerId,
    name: file.name,
    kind: file.kind,
    mime: file.mime,
    size: file.bytes.length,
    pageCount: file.pageCount,
    storageKey,
    taskId,
    createdAt: now,
    expiresAt: now + FILE_LIFETIME_MS,
  };
}

export function toRecord(
  row: Awaited<ReturnType<typeof storeFile>>,
): FileRecord {
  const { ownerId: _owner, storageKey: _key, ...record } = row;
  return record;
}

/** Validates and stores uploads; a bad file refuses the whole upload. */
export async function uploadFiles(
  ownerId: string,
  uploads: { name: string; bytes: Uint8Array }[],
): Promise<FileRecord[]> {
  if (uploads.length === 0) throw new PdfInputError("Choose at least one file");
  if (uploads.length > MAX_FILES_PER_UPLOAD) {
    throw new PdfInputError(
      `Upload at most ${MAX_FILES_PER_UPLOAD} files at a time`,
    );
  }
  const prepared: NewFile[] = [];
  for (const upload of uploads) {
    const name = cleanName(upload.name, "file");
    if (upload.bytes.length > MAX_FILE_BYTES)
      throw new PdfInputError(`${name} is larger than 50 MB`);
    const type = sniff(upload.bytes);
    if (!type) throw new PdfInputError(`${name} is not a PDF, JPG or PNG`);
    let pageCount: number | null = null;
    if (type.kind === "pdf") {
      try {
        pageCount = (await openPdf(upload.bytes)).getPageCount();
      } catch (error) {
        if (error instanceof PdfInputError)
          throw new PdfInputError(`${name}: ${error.message}`);
        throw error;
      }
    }
    prepared.push({ name, bytes: upload.bytes, pageCount, ...type });
  }
  const now = Date.now();
  const rows = [];
  for (const file of prepared)
    rows.push(await storeFile(ownerId, file, null, now));
  await db.insert(files).values(rows);
  return rows.map(toRecord);
}

export async function deleteFile(ownerId: string, id: string): Promise<void> {
  const file = await getFile(ownerId, id);
  await db
    .delete(files)
    .where(and(eq(files.id, id), eq(files.ownerId, ownerId)));
  await env.files.delete(file.storageKey);
}

/** Deletes every expired file (row and bytes) and expired task. */
export async function purgeExpired(now = Date.now()): Promise<number> {
  let removed = 0;
  for (;;) {
    const batch = await db
      .select({ id: files.id, storageKey: files.storageKey })
      .from(files)
      .where(lte(files.expiresAt, now))
      .limit(200);
    if (batch.length === 0) break;
    await env.files.delete(batch.map((f) => f.storageKey));
    await db.delete(files).where(
      inArray(
        files.id,
        batch.map((f) => f.id),
      ),
    );
    removed += batch.length;
  }
  await db.delete(tasks).where(lte(tasks.expiresAt, now));
  return removed;
}

/** Organization-wide totals for admins; no names or contents. */
export async function totals() {
  const now = Date.now();
  const [fileTotals] = await db
    .select({
      files: sql<number>`count(*)`,
      bytes: sql<number>`coalesce(sum(${files.size}), 0)`,
    })
    .from(files)
    .where(gt(files.expiresAt, now));
  const [taskTotals] = await db
    .select({ tasks: sql<number>`count(*)` })
    .from(tasks)
    .where(gt(tasks.expiresAt, now));
  const [userTotals] = await db
    .select({ members: sql<number>`count(*)` })
    .from(users);
  const [expired] = await db
    .select({ n: sql<number>`count(*)` })
    .from(files)
    .where(lte(files.expiresAt, now));
  return {
    files: Number(fileTotals?.files ?? 0),
    bytes: Number(fileTotals?.bytes ?? 0),
    tasks: Number(taskTotals?.tasks ?? 0),
    members: Number(userTotals?.members ?? 0),
    expiredWaiting: Number(expired?.n ?? 0),
  };
}
