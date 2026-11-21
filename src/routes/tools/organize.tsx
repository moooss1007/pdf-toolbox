import { createFileRoute } from "@tanstack/react-router";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { FilePicker } from "@/client/components/FilePicker";
import { PageThumb } from "@/client/components/PageThumb";
import { Section, ToolPage } from "@/client/components/ToolPage";
import { Button } from "@/client/components/ui/button";
import { useRunTask } from "@/client/hooks/useRunTask";
import { errorMessage } from "@/client/lib/format";
import { openWorkspacePdf } from "@/client/lib/pdfjs";
import { getFiles } from "@/serverFunctions/files";

export const Route = createFileRoute("/tools/organize")({
  // Page pictures are drawn by pdf.js, which needs the browser.
  ssr: false,
  loader: () => getFiles({ data: {} }),
  component: OrganizePage,
});

type Turn = 0 | 90 | 180 | 270;
interface Item {
  key: string;
  source: number | null;
  rotate: Turn;
}

const turn = (rotate: Turn, by: number) =>
  ((((rotate + by) % 360) + 360) % 360) as Turn;

function OrganizePage() {
  const files = Route.useLoaderData();
  const [picked, setPicked] = useState<string[]>([]);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const task = useRunTask();
  const fileId = picked[0];

  useEffect(() => {
    setDoc(null);
    setItems([]);
    setLoadError(null);
    if (!fileId) return;
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    openWorkspacePdf(fileId)
      .then((pdf) => {
        opened = pdf;
        if (cancelled) return void pdf.destroy();
        setDoc(pdf);
        setItems(
          Array.from({ length: pdf.numPages }, (_, i) => ({
            key: `p${i + 1}`,
            source: i + 1,
            rotate: 0 as Turn,
          })),
        );
      })
      .catch((error) => setLoadError(errorMessage(error)));
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
  }, [fileId]);

  const update = (index: number, change: (item: Item) => Item | null) =>
    setItems((current) =>
      current.flatMap((item, i) => {
        if (i !== index) return [item];
        const next = change(item);
        return next ? [next] : [];
      }),
    );
  const move = (from: number, to: number) =>
    setItems((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  const insertBlank = (after: number) =>
    setItems((current) => {
      const next = [...current];
      next.splice(after + 1, 0, {
        key: `b${crypto.randomUUID()}`,
        source: null,
        rotate: 0,
      });
      return next;
    });

  return (
    <ToolPage
      title="Organize pages"
      description="Reorder, rotate, delete or add blank pages, then save a new PDF."
      runLabel="Save PDF"
      canRun={Boolean(fileId) && items.length > 0}
      running={task.running}
      error={
        task.error ??
        loadError ??
        (fileId && doc && items.length === 0 ? "Keep at least one page." : null)
      }
      onRun={() =>
        void task.run({
          tool: "organize",
          inputs: picked,
          options: {
            pages: items.map(({ source, rotate }) => ({ source, rotate })),
          },
        })
      }
    >
      <Section title="PDF">
        <FilePicker
          files={files}
          kind="pdf"
          selected={picked}
          onChange={setPicked}
        />
      </Section>
      {fileId && items.length > 0 ? (
        <Section title={`Pages (${items.length})`}>
          <div className="flex flex-wrap gap-2">
            {([90, 180, 270] as const).map((by) => (
              <Button
                key={by}
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems((current) =>
                    current.map((item) => ({
                      ...item,
                      rotate: turn(item.rotate, by),
                    })),
                  )
                }
              >
                <RotateCw />
                Rotate all {by}°
              </Button>
            ))}
          </div>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((item, index) => (
              <li
                key={item.key}
                data-testid="page-thumb"
                className="space-y-1.5 rounded-lg border border-border bg-card p-2"
              >
                <PageThumb
                  doc={doc}
                  pageNumber={item.source}
                  rotate={item.rotate}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {item.source === null ? "Blank" : `Page ${item.source}`}
                  </span>
                  {item.rotate ? <span>{item.rotate}°</span> : null}
                </div>
                <div className="flex flex-wrap justify-center gap-0.5">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Move left"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Rotate page"
                    onClick={() =>
                      update(index, (it) => ({
                        ...it,
                        rotate: turn(it.rotate, 90),
                      }))
                    }
                  >
                    <RotateCw />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Add blank page after"
                    onClick={() => insertBlank(index)}
                  >
                    <FilePlus />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Delete page"
                    onClick={() => update(index, () => null)}
                  >
                    <Trash2 />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Move right"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </ToolPage>
  );
}
