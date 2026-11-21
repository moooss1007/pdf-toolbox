import {
  PDFArray,
  PDFDocument,
  PDFName,
  StandardFonts,
  degrees,
  rgb,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { z } from "zod";
import {
  PdfInputError,
  checkRange,
  splitGroups,
  type SplitOptions,
} from "./pages";

export { splitOptions } from "./pages";

export interface OutputDoc {
  /** File name without the folder; always ends in .pdf. */
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

export async function openPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    if (error instanceof Error && /encrypt/i.test(error.message)) {
      throw new PdfInputError("This PDF is password-protected");
    }
    throw new PdfInputError("This file is not a readable PDF");
  }
}

async function save(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true });
}

async function copyPages(
  source: PDFDocument,
  indices: number[],
): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const pages = await doc.copyPages(source, indices);
  for (const page of pages) doc.addPage(page);
  return doc;
}

const baseName = (name: string) => name.replace(/\.[a-z0-9]+$/i, "");

// ---- Merge ----

export async function merge(
  inputs: { name: string; bytes: Uint8Array }[],
): Promise<OutputDoc> {
  if (inputs.length < 2) throw new PdfInputError("Choose at least two PDFs");
  const out = await PDFDocument.create();
  for (const input of inputs) {
    const source = await openPdf(input.bytes);
    const pages = await out.copyPages(source, source.getPageIndices());
    for (const page of pages) out.addPage(page);
  }
  return {
    name: "merged.pdf",
    bytes: await save(out),
    pageCount: out.getPageCount(),
  };
}

// ---- Split ----

export async function split(
  input: { name: string; bytes: Uint8Array },
  options: SplitOptions,
): Promise<OutputDoc[]> {
  const source = await openPdf(input.bytes);
  const groups = splitGroups(options, source.getPageCount());
  const outputs: OutputDoc[] = [];
  for (const group of groups) {
    const doc = await copyPages(
      source,
      group.map((p) => p - 1),
    );
    const first = group[0]!;
    const last = group[group.length - 1]!;
    const label =
      group.length === 1
        ? `page-${first}`
        : group.length === last - first + 1
          ? `pages-${first}-${last}`
          : `${group.length}-pages`;
    outputs.push({
      name: `${baseName(input.name)}-${label}.pdf`,
      bytes: await save(doc),
      pageCount: group.length,
    });
  }
  return outputs;
}

// ---- Organize ----

const rotation = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

export const organizeOptions = z.object({
  pages: z
    .array(
      z.object({
        // A 1-based page of the source, or null for a blank page.
        source: z.number().int().min(1).nullable(),
        rotate: rotation.default(0),
      }),
    )
    .max(5000),
});
type OrganizeOptions = z.infer<typeof organizeOptions>;

export async function organize(
  input: { name: string; bytes: Uint8Array },
  options: OrganizeOptions,
): Promise<OutputDoc> {
  if (options.pages.length === 0)
    throw new PdfInputError("Keep at least one page");
  const source = await openPdf(input.bytes);
  const count = source.getPageCount();
  const out = await PDFDocument.create();
  let lastSize: [number, number] = [595.28, 841.89];
  for (const spec of options.pages) {
    let page: PDFPage;
    if (spec.source === null) {
      page = out.addPage(lastSize);
    } else {
      if (spec.source > count) {
        throw new PdfInputError(`Page ${spec.source} is outside this document`);
      }
      [page] = (await out.copyPages(source, [spec.source - 1])) as [PDFPage];
      out.addPage(page);
      const { width, height } = page.getSize();
      lastSize = [width, height];
    }
    const turned = (page.getRotation().angle + spec.rotate) % 360;
    page.setRotation(degrees(turned));
  }
  return {
    name: `${baseName(input.name)}-organized.pdf`,
    bytes: await save(out),
    pageCount: out.getPageCount(),
  };
}

// ---- Compress ----

export const compressOptions = z.object({ level: z.enum(["basic", "strong"]) });

interface CompressResult {
  output: OutputDoc;
  originalSize: number;
  newSize: number;
  savedPercent: number;
  reduced: boolean;
}

export async function compress(
  input: { name: string; bytes: Uint8Array },
  { level }: z.infer<typeof compressOptions>,
): Promise<CompressResult> {
  const doc = await openPdf(input.bytes);
  if (level === "strong") {
    // Drop what a reader never shows: document metadata, page thumbnails
    // and editor-private data.
    const catalog = doc.catalog;
    catalog.delete(PDFName.of("Metadata"));
    catalog.delete(PDFName.of("PieceInfo"));
    doc.context.trailerInfo.Info = undefined;
    for (const page of doc.getPages()) {
      page.node.delete(PDFName.of("Thumb"));
      page.node.delete(PDFName.of("PieceInfo"));
      page.node.delete(PDFName.of("Metadata"));
    }
  }
  // Only what the document still references is written, packed into
  // compressed object streams.
  const packed = await doc.save({
    useObjectStreams: true,
    updateFieldAppearances: false,
  });
  const pageCount = doc.getPageCount();
  return compressResult(input, packed, pageCount);
}

/** Keeps the original when packing saved nothing. */
export function compressResult(
  input: { name: string; bytes: Uint8Array },
  packed: Uint8Array,
  pageCount: number,
): CompressResult {
  const originalSize = input.bytes.length;
  const reduced = packed.length < originalSize;
  const bytes = reduced ? packed : input.bytes;
  return {
    output: {
      name: `${baseName(input.name)}-compressed.pdf`,
      bytes,
      pageCount,
    },
    originalSize,
    newSize: bytes.length,
    savedPercent: reduced
      ? Math.round(((originalSize - bytes.length) / originalSize) * 1000) / 10
      : 0,
    reduced,
  };
}

// ---- Shared stamping ----

const positions = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

/** The 1-based pages a stamp goes on. */
function pageSpan(
  pageCount: number,
  from: number | undefined,
  to: number | undefined,
): Set<number> {
  const first = from ?? 1;
  const last = to ?? pageCount;
  checkRange(first, last, pageCount);
  return new Set(Array.from({ length: last - first + 1 }, (_, i) => first + i));
}

/** Moves the stamp drawn last on a page beneath the page's own content. */
function sendStampUnder(page: PDFPage): void {
  const contents = page.node.Contents();
  if (!(contents instanceof PDFArray) || contents.size() < 2) return;
  const stamp = contents.get(contents.size() - 1);
  contents.remove(contents.size() - 1);
  contents.insert(0, stamp);
}

/**
 * Where to put the origin of a box of `w`×`h` turned by `angle` degrees about
 * that origin, so that the turned box is centred on (cx, cy).
 */
function originFor(
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
) {
  const r = (angle * Math.PI) / 180;
  const dx = (w / 2) * Math.cos(r) - (h / 2) * Math.sin(r);
  const dy = (w / 2) * Math.sin(r) + (h / 2) * Math.cos(r);
  return { x: cx - dx, y: cy - dy };
}

/** Centres for a stamp of the given turned extent, at a position or tiled. */
function centres(
  page: PDFPage,
  position: (typeof positions)[number] | "tiled",
  extentW: number,
  extentH: number,
  margin: number,
): { x: number; y: number }[] {
  const { width, height } = page.getSize();
  if (position === "tiled") {
    const stepX = Math.max(extentW * 1.5, 60);
    const stepY = Math.max(extentH * 2, 60);
    const points: { x: number; y: number }[] = [];
    let row = 0;
    for (let y = stepY / 2; y < height; y += stepY, row++) {
      const offset = row % 2 ? stepX / 2 : 0;
      for (let x = stepX / 2 - offset; x < width + stepX / 2; x += stepX) {
        points.push({ x, y });
      }
    }
    return points;
  }
  const [vertical, horizontal] = position.split("-") as [string, string];
  const x =
    horizontal === "left"
      ? margin + extentW / 2
      : horizontal === "right"
        ? width - margin - extentW / 2
        : width / 2;
  const y =
    vertical === "top"
      ? height - margin - extentH / 2
      : vertical === "bottom"
        ? margin + extentH / 2
        : height / 2;
  return [{ x, y }];
}

function turnedExtent(w: number, h: number, angle: number) {
  const r = (angle * Math.PI) / 180;
  return {
    w: Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r)),
    h: Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)),
  };
}

function hexColour(value: string) {
  const n = Number.parseInt(value.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// ---- Watermark ----

const stampCommon = {
  opacity: z.number().min(0.05).max(1),
  rotation: z.number().int().min(-360).max(360),
  position: z.enum([...positions, "tiled"]),
  from: z.number().int().min(1).optional(),
  to: z.number().int().min(1).optional(),
  layer: z.enum(["over", "under"]),
};

export const watermarkOptions = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().trim().min(1, "Enter the watermark text").max(200),
    fontSize: z.number().min(6).max(200),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
    ...stampCommon,
  }),
  z.object({
    type: z.literal("image"),
    imageId: z.string().min(1, "Choose an image"),
    ...stampCommon,
  }),
]);
type WatermarkOptions = z.infer<typeof watermarkOptions>;

export async function watermark(
  input: { name: string; bytes: Uint8Array },
  options: WatermarkOptions,
  image?: { bytes: Uint8Array; mime: string },
): Promise<OutputDoc> {
  const doc = await openPdf(input.bytes);
  const span = pageSpan(doc.getPageCount(), options.from, options.to);
  const angle = options.rotation;
  let draw: (page: PDFPage) => void;
  if (options.type === "text") {
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const text = options.text.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
    const w = font.widthOfTextAtSize(text, options.fontSize);
    const h = font.heightAtSize(options.fontSize, { descender: false });
    const extent = turnedExtent(w, h, angle);
    draw = (page) => {
      for (const c of centres(page, options.position, extent.w, extent.h, 24)) {
        const origin = originFor(c.x, c.y, w, h, angle);
        page.drawText(text, {
          ...origin,
          size: options.fontSize,
          font,
          color: hexColour(options.color),
          opacity: options.opacity,
          rotate: degrees(angle),
        });
      }
    };
  } else {
    if (!image) throw new PdfInputError("Choose an image");
    const embedded: PDFImage =
      image.mime === "image/png"
        ? await doc.embedPng(image.bytes)
        : await doc.embedJpg(image.bytes);
    draw = (page) => {
      const { width } = page.getSize();
      const scale = Math.min(1, (width * 0.4) / embedded.width);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      const extent = turnedExtent(w, h, angle);
      for (const c of centres(page, options.position, extent.w, extent.h, 24)) {
        page.drawImage(embedded, {
          ...originFor(c.x, c.y, w, h, angle),
          width: w,
          height: h,
          opacity: options.opacity,
          rotate: degrees(angle),
        });
      }
    };
  }
  doc.getPages().forEach((page, index) => {
    if (!span.has(index + 1)) return;
    draw(page);
    if (options.layer === "under") sendStampUnder(page);
  });
  return {
    name: `${baseName(input.name)}-watermarked.pdf`,
    bytes: await save(doc),
    pageCount: doc.getPageCount(),
  };
}

// ---- Page numbers ----

export const pageNumberOptions = z.object({
  vertical: z.enum(["top", "bottom"]),
  horizontal: z.enum(["left", "center", "right"]),
  margin: z.enum(["small", "medium", "large"]),
  start: z.number().int().min(0).max(100000),
  from: z.number().int().min(1).optional(),
  to: z.number().int().min(1).optional(),
  skipFirst: z.boolean(),
  template: z.enum(["n", "page-n", "page-n-of-p", "custom"]),
  custom: z.string().max(200).optional(),
  fontSize: z.number().min(6).max(72),
});
type PageNumberOptions = z.infer<typeof pageNumberOptions>;

const MARGINS = { small: 18, medium: 36, large: 60 } as const;

/** The label for number `n` of `total`. */
export function pageLabel(
  options: PageNumberOptions,
  n: number,
  total: number,
): string {
  const template =
    options.template === "n"
      ? "{n}"
      : options.template === "page-n"
        ? "Page {n}"
        : options.template === "page-n-of-p"
          ? "Page {n} of {p}"
          : options.custom?.trim() || "{n}";
  return template.replaceAll("{n}", String(n)).replaceAll("{p}", String(total));
}

export async function addPageNumbers(
  input: { name: string; bytes: Uint8Array },
  options: PageNumberOptions,
): Promise<OutputDoc> {
  const doc = await openPdf(input.bytes);
  const span = pageSpan(doc.getPageCount(), options.from, options.to);
  if (options.skipFirst) span.delete(1);
  const numbered = [...span].sort((a, b) => a - b);
  const total = options.start + numbered.length - 1;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const margin = MARGINS[options.margin];
  const pages = doc.getPages();
  numbered.forEach((pageNumber, i) => {
    const page = pages[pageNumber - 1]!;
    const text = pageLabel(options, options.start + i, total).replace(
      /[^\x20-\x7e\xa0-\xff]/g,
      "?",
    );
    const { width, height } = page.getSize();
    const w = font.widthOfTextAtSize(text, options.fontSize);
    const x =
      options.horizontal === "left"
        ? margin
        : options.horizontal === "right"
          ? width - margin - w
          : (width - w) / 2;
    const y =
      options.vertical === "top" ? height - margin - options.fontSize : margin;
    page.drawText(text, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });
  return {
    name: `${baseName(input.name)}-numbered.pdf`,
    bytes: await save(doc),
    pageCount: doc.getPageCount(),
  };
}

// ---- Images to PDF ----

export const imagesToPdfOptions = z.object({
  pageSize: z.enum(["fit", "a4", "letter"]),
  orientation: z.enum(["portrait", "landscape"]),
  margin: z.enum(["none", "small", "big"]),
  oneFile: z.boolean(),
});
type ImagesToPdfOptions = z.infer<typeof imagesToPdfOptions>;

const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const IMAGE_MARGINS = { none: 0, small: 20, big: 40 } as const;

export async function imagesToPdf(
  images: { name: string; bytes: Uint8Array; mime: string }[],
  options: ImagesToPdfOptions,
): Promise<OutputDoc[]> {
  if (images.length === 0) throw new PdfInputError("Choose at least one image");
  const margin = IMAGE_MARGINS[options.margin];
  const docs: PDFDocument[] = [];
  let doc = await PDFDocument.create();
  for (const [index, image] of images.entries()) {
    if (!options.oneFile && index > 0) {
      docs.push(doc);
      doc = await PDFDocument.create();
    }
    let embedded: PDFImage;
    try {
      embedded =
        image.mime === "image/png"
          ? await doc.embedPng(image.bytes)
          : await doc.embedJpg(image.bytes);
    } catch {
      throw new PdfInputError(`${image.name} is not a readable image`);
    }
    let pageW: number;
    let pageH: number;
    if (options.pageSize === "fit") {
      pageW = embedded.width + margin * 2;
      pageH = embedded.height + margin * 2;
    } else {
      const [w, h] = SIZES[options.pageSize];
      [pageW, pageH] = options.orientation === "landscape" ? [h, w] : [w, h];
    }
    const page = doc.addPage([pageW, pageH]);
    const scale = Math.min(
      (pageW - margin * 2) / embedded.width,
      (pageH - margin * 2) / embedded.height,
      options.pageSize === "fit" ? 1 : Number.POSITIVE_INFINITY,
    );
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    page.drawImage(embedded, {
      x: (pageW - w) / 2,
      y: (pageH - h) / 2,
      width: w,
      height: h,
    });
  }
  docs.push(doc);
  const outputs: OutputDoc[] = [];
  for (const [index, made] of docs.entries()) {
    outputs.push({
      name: options.oneFile
        ? "images.pdf"
        : `${baseName(images[index]!.name)}.pdf`,
      bytes: await save(made),
      pageCount: made.getPageCount(),
    });
  }
  return outputs;
}
