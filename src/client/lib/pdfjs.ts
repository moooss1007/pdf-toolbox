import type { PDFDocumentProxy } from "pdfjs-dist";

/** pdf.js, loaded in the browser only, with its worker bundled as an asset. */
async function pdfjs() {
  const [lib, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
}

/** Opens one of the member's PDFs from the workspace. */
export async function openWorkspacePdf(
  fileId: string,
): Promise<PDFDocumentProxy> {
  const response = await fetch(`/api/files/${fileId}?inline`);
  if (!response.ok) throw new Error("This PDF could not be opened");
  const data = new Uint8Array(await response.arrayBuffer());
  const lib = await pdfjs();
  return lib.getDocument({ data }).promise;
}

/** Draws a page into a canvas `scale` times its size in points. */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't draw pages");
  // A white sheet behind the page, as on paper; JPG has no transparency.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
}

/** The page as a JPG, at about 144 dpi. */
export async function pageToJpeg(
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderPage(doc, pageNumber, canvas, 2);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Page could not be saved")),
      "image/jpeg",
      0.9,
    ),
  );
}
