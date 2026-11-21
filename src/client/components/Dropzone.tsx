import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/client/components/ui/button";
import { Spinner } from "@/client/components/ui/spinner";
import { errorMessage } from "@/client/lib/format";
import { uploadToWorkspace } from "@/client/lib/upload";
import type { FileRecord } from "@/server/files";

const ACCEPT = {
  any: "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png",
  pdf: "application/pdf,.pdf",
  image: "image/jpeg,image/png,.jpg,.jpeg,.png",
};

/** Drop or choose files; they're uploaded to the workspace straight away. */
export function Dropzone({
  accept = "any",
  onUploaded,
  compact = false,
}: {
  accept?: keyof typeof ACCEPT;
  onUploaded: (files: FileRecord[]) => void | Promise<void>;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const uploaded = await uploadToWorkspace(chosen);
      await onUploaded(uploaded);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const label =
    accept === "pdf"
      ? "PDFs"
      : accept === "image"
        ? "JPG or PNG images"
        : "PDFs, JPGs or PNGs";

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        void send(event.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center transition-colors",
        compact ? "px-4 py-5" : "px-6 py-10",
        over ? "border-primary bg-muted" : "bg-card",
      )}
    >
      {!compact ? (
        <Upload className="size-6 text-muted-foreground" aria-hidden />
      ) : null}
      <p className="text-sm text-muted-foreground">
        Drop {label} here, up to 50 MB each
      </p>
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? <Spinner /> : null}
        {busy ? "Uploading…" : "Choose files"}
      </Button>
      <input
        ref={input}
        data-testid="upload-input"
        type="file"
        multiple
        accept={ACCEPT[accept]}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void send(event.target.files)}
      />
    </div>
  );
}
