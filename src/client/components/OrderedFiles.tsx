import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { pages } from "@/client/lib/format";
import type { FileRecord } from "@/server/files";

/** The picked files in the order they'll be used: move, sort by name, remove. */
export function OrderedFiles({
  files,
  order,
  onChange,
}: {
  files: FileRecord[];
  order: string[];
  onChange: (ids: string[]) => void;
}) {
  const byId = new Map(files.map((file) => [file.id, file]));
  const picked = order
    .map((id) => byId.get(id))
    .filter((f): f is FileRecord => Boolean(f));
  if (picked.length === 0) return null;

  const move = (from: number, to: number) => {
    const next = picked.map((f) => f.id);
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id!);
    onChange(next);
  };
  const sort = (direction: 1 | -1) =>
    onChange(
      [...picked]
        .sort(
          (a, b) =>
            direction *
            a.name.localeCompare(b.name, undefined, {
              sensitivity: "base",
              numeric: true,
            }),
        )
        .map((f) => f.id),
    );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Order</h2>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            data-testid="sort-asc"
            onClick={() => sort(1)}
          >
            Name A–Z
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="sort-desc"
            onClick={() => sort(-1)}
          >
            Name Z–A
          </Button>
        </div>
      </div>
      <ol className="divide-y divide-border rounded-xl border border-border bg-card">
        {picked.map((file, index) => (
          <li
            key={file.id}
            data-testid="selected-file"
            className="flex items-center gap-2 px-4 py-2"
          >
            <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
            {file.pageCount !== null ? (
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {pages(file.pageCount)}
              </span>
            ) : null}
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
            >
              <ArrowUp />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Move down"
              disabled={index === picked.length - 1}
              onClick={() => move(index, index + 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove"
              onClick={() =>
                onChange(
                  picked.filter((f) => f.id !== file.id).map((f) => f.id),
                )
              }
            >
              <X />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}
