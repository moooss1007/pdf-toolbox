import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";
import { PageThumb } from "@/client/components/PageThumb";
import { openWorkspacePdf } from "@/client/lib/pdfjs";

const SHOWN = 8;

/** The first pages of a PDF in the workspace, drawn in the browser. */
export function PdfPreview({
  fileId,
  pageCount,
}: {
  fileId: string;
  pageCount: number;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    openWorkspacePdf(fileId)
      .then((pdf) => {
        opened = pdf;
        if (cancelled) void pdf.destroy();
        else setDoc(pdf);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
  }, [fileId]);

  if (failed) return null;
  const shown = Math.min(pageCount, SHOWN);
  return (
    <div className="space-y-2" data-testid="pdf-preview">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: shown }, (_, i) => (
          <li key={i} className="space-y-1">
            <PageThumb doc={doc} pageNumber={i + 1} rotate={0} />
            <p className="text-center text-xs text-muted-foreground">{i + 1}</p>
          </li>
        ))}
      </ol>
      {pageCount > shown ? (
        <p className="text-sm text-muted-foreground">
          and {pageCount - shown} more pages
        </p>
      ) : null}
    </div>
  );
}
