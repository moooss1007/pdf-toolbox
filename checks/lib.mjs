// Shared helpers for the release checks: sample documents and API calls.
import zlib from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

/** A PDF whose pages carry the given lines of text, one page per entry. */
export async function makePdf(
  lines,
  { width = 595, height = 842, objectStreams = true, title } = {},
) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  if (title) doc.setTitle(title);
  for (const line of lines) {
    const page = doc.addPage([width, height]);
    page.drawText(line, { x: 50, y: height - 80, size: 18, font });
  }
  return Buffer.from(await doc.save({ useObjectStreams: objectStreams }));
}

/** A solid-colour PNG, encoded by hand. */
export function makePng(width, height, [r, g, b]) {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Upload files as a member; returns the created file records. */
export async function upload(runtime, role, files) {
  const form = new FormData();
  for (const { name, type, bytes } of files)
    form.append("file", new Blob([bytes], { type }), name);
  const response = await runtime.fetch("/api/files", {
    role,
    method: "POST",
    body: form,
  });
  expect(response.status, await response.clone().text()).toBe(201);
  return (await response.json()).files;
}

export async function runTask(runtime, role, body, status = 201) {
  const response = await runtime.fetch("/api/tasks", {
    role,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  expect(response.status, text).toBe(status);
  return JSON.parse(text);
}

export async function download(runtime, role, id) {
  const response = await runtime.fetch(`/api/files/${id}`, { role });
  expect(response.status).toBe(200);
  return Buffer.from(await response.arrayBuffer());
}

export async function loadPdf(bytes) {
  return PDFDocument.load(bytes);
}

/** The text on each page, as pdf.js reads it. */
export async function pageTexts(bytes) {
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
  }).promise;
  const texts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    texts.push(content.items.map((item) => item.str).join(" "));
  }
  await doc.destroy();
  return texts;
}

export const pdf = (name, bytes) => ({ name, type: "application/pdf", bytes });
export const png = (name, bytes) => ({ name, type: "image/png", bytes });
