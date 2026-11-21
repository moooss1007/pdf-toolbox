import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowDownAZ, ArrowUpAZ, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Dropzone } from "@/client/components/Dropzone";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { errorMessage, formatBytes, timeLeft } from "@/client/lib/format";
import { deleteFile, getFiles } from "@/serverFunctions/files";
import type { FileRecord } from "@/server/files";

type Sort = "newest" | "name-asc" | "name-desc";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { sort?: Sort } =>
    search.sort === "name-asc" || search.sort === "name-desc"
      ? { sort: search.sort }
      : {},
  loaderDeps: ({ search }) => ({ sort: search.sort ?? "newest" }),
  loader: ({ deps }) => getFiles({ data: { sort: deps.sort } }),
  component: FilesPage,
});

function FilesPage() {
  const files = Route.useLoaderData();
  const { sort = "newest" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [deleting, setDeleting] = useState<FileRecord | null>(null);
  const [pending, setPending] = useState(false);

  const nextSort: Sort = sort === "name-asc" ? "name-desc" : "name-asc";

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    try {
      await deleteFile({ data: { id: deleting.id } });
      await router.invalidate();
      setDeleting(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Files"
        description="Files are deleted two hours after they're added."
      />
      <Dropzone onUploaded={() => router.invalidate()} />
      {files.length === 0 ? (
        <EmptyState
          media="rows"
          title="No files yet"
          description="Upload a PDF or image, or open a tool."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2"
                    data-testid="sort-name"
                    onClick={() =>
                      void navigate({ search: { sort: nextSort } })
                    }
                  >
                    Name
                    {sort === "name-desc" ? <ArrowUpAZ /> : <ArrowDownAZ />}
                  </Button>
                </TableHead>
                <TableHead className="text-right">Pages</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Deleted in
                </TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id} data-testid="file-row">
                  <TableCell
                    className="max-w-56 truncate font-medium sm:max-w-80"
                    title={file.name}
                  >
                    {file.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {file.pageCount ?? "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell className="hidden text-right whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                    {timeLeft(file.expiresAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Download ${file.name}`}
                        render={
                          <a
                            href={`/api/files/${file.id}`}
                            download={file.name}
                          />
                        }
                        nativeButton={false}
                      >
                        <Download />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${file.name}`}
                        onClick={() => setDeleting(file)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </AppShell>
  );
}
