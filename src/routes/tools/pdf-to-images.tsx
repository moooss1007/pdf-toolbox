import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FilePicker } from "@/client/components/FilePicker";
import { Section, ToolPage } from "@/client/components/ToolPage";
import { errorMessage } from "@/client/lib/format";
import { openWorkspacePdf, pageToJpeg } from "@/client/lib/pdfjs";
import { getFiles } from "@/serverFunctions/files";

export const Route = createFileRoute("/tools/pdf-to-images")({
  // Pages are drawn by pdf.js in the browser, then saved to the workspace.
  ssr: false,
  loader: () => getFiles({ data: {} }),
  component: PdfToImagesPage,
});

function PdfToImagesPage() {
  const files = Route.useLoaderData();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function convert() {
    const source = picked[0];
    if (!source) return;
    setRunning(true);
    setError(null);
    try {
      const doc = await openWorkspacePdf(source);
      const form = new FormData();
      form.append("source", source);
      for (let page = 1; page <= doc.numPages; page++) {
        setProgress(`Page ${page} of ${doc.numPages}`);
        form.append("image", await pageToJpeg(doc, page), `page-${page}.jpg`);
      }
      await doc.destroy();
      setProgress("Saving…");
      const response = await fetch("/api/page-images", {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => ({}))) as {
        task?: { id: string };
        error?: string;
      };
      if (!response.ok || !body.task)
        throw new Error(body.error ?? "The images could not be saved");
      await navigate({ to: "/tasks/$id", params: { id: body.task.id } });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  return (
    <ToolPage
      title="PDF to JPG"
      description="Save every page of a PDF as a JPG image."
      runLabel="Convert"
      canRun={picked.length === 1}
      running={running}
      error={error}
      onRun={() => void convert()}
      footnote={progress}
    >
      <Section title="PDF">
        <FilePicker
          files={files}
          kind="pdf"
          selected={picked}
          onChange={setPicked}
        />
      </Section>
    </ToolPage>
  );
}
