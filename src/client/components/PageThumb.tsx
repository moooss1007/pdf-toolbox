import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/client/components/ui/skeleton";
import { renderPage } from "@/client/lib/pdfjs";

/** A small picture of one page (or a blank sheet), turned by `rotate` degrees. */
export function PageThumb({
  doc,
  pageNumber,
  rotate,
}: {
  doc: PDFDocumentProxy | null;
  pageNumber: number | null;
  rotate: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!doc || pageNumber === null || !canvas.current) return;
    void renderPage(doc, pageNumber, canvas.current, 0.35).catch(
      () => undefined,
    );
  }, [doc, pageNumber]);

  return (
    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted p-2">
      <div
        className="transition-transform"
        style={{ transform: `rotate(${rotate}deg)` }}
      >
        {pageNumber === null ? (
          <div
            className="aspect-[1/1.414] w-20 border border-border bg-background"
            aria-label="Blank page"
          />
        ) : doc ? (
          <canvas
            ref={canvas}
            className="max-h-32 max-w-full border border-border shadow-sm"
          />
        ) : (
          <Skeleton className="aspect-[1/1.414] w-20" />
        )}
      </div>
    </div>
  );
}
