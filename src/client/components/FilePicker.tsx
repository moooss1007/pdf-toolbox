import { useRouter } from "@tanstack/react-router";
import { FileImage, FileText } from "lucide-react";
import { Dropzone } from "@/client/components/Dropzone";
import { EmptyState } from "@/client/components/EmptyState";
import { Checkbox } from "@/client/components/ui/checkbox";
import { formatBytes, pages } from "@/client/lib/format";
import type { FileRecord } from "@/server/files";

/**
 * Pick input files from the member's workspace, or upload new ones (which
 * are picked straight away). `multiple` keeps the order they were picked in.
 */
export function FilePicker({
  files,
  kind,
  multiple = false,
  selected,
  onChange,
}: {
  files: FileRecord[];
  kind: "pdf" | "image";
  multiple?: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const router = useRouter();
  const eligible = files.filter((file) => file.kind === kind);

  function toggle(id: string, on: boolean) {
    if (!multiple) return onChange(on ? [id] : []);
    onChange(
      on
        ? [...selected.filter((s) => s !== id), id]
        : selected.filter((s) => s !== id),
    );
  }

  return (
    <div className="space-y-3">
      {eligible.length === 0 ? (
        <EmptyState
          variant="plain"
          size="sm"
          icon={kind === "pdf" ? FileText : FileImage}
          title={kind === "pdf" ? "No PDFs yet" : "No images yet"}
          description="Upload one below."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {eligible.map((file) => {
            const id = `pick-${file.id}`;
            return (
              <li key={file.id} className="flex items-center gap-3 px-4 py-2.5">
                <Checkbox
                  id={id}
                  aria-label={file.name}
                  checked={selected.includes(file.id)}
                  onCheckedChange={(on) => toggle(file.id, on === true)}
                />
                <label
                  htmlFor={id}
                  className="min-w-0 flex-1 cursor-pointer truncate text-sm"
                >
                  {file.name}
                </label>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {file.kind === "pdf" ? `${pages(file.pageCount)} · ` : ""}
                  {formatBytes(file.size)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Dropzone
        compact
        accept={kind}
        onUploaded={async (uploaded) => {
          await router.invalidate();
          const fresh = uploaded
            .filter((f) => f.kind === kind)
            .map((f) => f.id);
          if (fresh.length === 0) return;
          onChange(multiple ? [...selected, ...fresh] : [fresh[0]!]);
        }}
      />
    </div>
  );
}
