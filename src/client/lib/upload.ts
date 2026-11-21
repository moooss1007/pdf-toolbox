import type { FileRecord } from "@/server/files";

/** Sends files to the member's workspace; throws with the server's reason. */
export async function uploadToWorkspace(files: File[]): Promise<FileRecord[]> {
  const form = new FormData();
  for (const file of files) form.append("file", file, file.name);
  const response = await fetch("/api/files", { method: "POST", body: form });
  const body = (await response.json().catch(() => ({}))) as {
    files?: FileRecord[];
    error?: string;
  };
  if (!response.ok || !body.files)
    throw new Error(body.error ?? "Upload failed");
  return body.files;
}
