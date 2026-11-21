import { Link, createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { PdfPreview } from "@/client/components/PdfPreview";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { formatBytes, pages, timeLeft } from "@/client/lib/format";
import { TOOL_DONE } from "@/client/lib/toolNames";
import { getTask } from "@/serverFunctions/tasks";

export const Route = createFileRoute("/tasks/$id")({
  loader: ({ params }) => getTask({ data: { id: params.id } }),
  component: TaskPage,
});

function TaskPage() {
  const task = Route.useLoaderData();
  if (!task) {
    return (
      <AppShell nav={<AppNav />}>
        <PageHeader title="Result" />
        <div data-testid="task-not-found">
          <EmptyState
            kind="filtered"
            title="Nothing here"
            description="This result was deleted or never existed."
            action={
              <Button
                variant="outline"
                render={<Link to="/tools" />}
                nativeButton={false}
              >
                Open tools
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }
  const compress = task.tool === "compress" ? task.result : null;
  const count = task.outputs.length;

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={TOOL_DONE[task.tool] ?? "Done"}
        description={`From ${task.inputs.map((input) => input.name).join(", ")}`}
        actions={
          <Button
            variant="outline"
            render={<Link to="/tools" />}
            nativeButton={false}
          >
            Another task
          </Button>
        }
      />
      {compress ? (
        <Alert
          variant={compress.reduced ? "success" : "default"}
          data-testid="task-summary"
        >
          <AlertDescription>
            {compress.reduced
              ? `${formatBytes(compress.originalSize)} → ${formatBytes(compress.newSize)}, ${compress.savedPercent}% smaller.`
              : `This PDF can't be made smaller; the copy below is the same as the original (${formatBytes(compress.originalSize)}).`}
          </AlertDescription>
        </Alert>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          {count === 1 ? "1 file" : `${count} files`}
          <span className="font-normal text-muted-foreground">
            {" "}
            · deleted in {timeLeft(task.expiresAt)}
          </span>
        </h2>
        {count === 0 ? (
          <EmptyState title="The files from this task have been deleted" />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {task.outputs.map((file) => (
              <li
                key={file.id}
                data-testid="task-output"
                data-file-id={file.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.kind === "pdf" ? `${pages(file.pageCount)} · ` : ""}
                    {formatBytes(file.size)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={count === 1 ? "default" : "outline"}
                  render={
                    <a href={`/api/files/${file.id}`} download={file.name} />
                  }
                  nativeButton={false}
                >
                  <Download />
                  Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {count === 1 &&
      task.outputs[0]?.kind === "pdf" &&
      task.outputs[0].pageCount ? (
        <PdfPreview
          fileId={task.outputs[0].id}
          pageCount={task.outputs[0].pageCount}
        />
      ) : null}
    </AppShell>
  );
}
