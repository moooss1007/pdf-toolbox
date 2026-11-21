import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";

/** A tool's page: its inputs and options, then the button that runs it. */
export function ToolPage({
  title,
  description,
  children,
  runLabel,
  canRun,
  running,
  error,
  onRun,
  footnote,
}: {
  title: string;
  description: string;
  children: ReactNode;
  runLabel: string;
  canRun: boolean;
  running: boolean;
  error: string | null;
  onRun: () => void;
  footnote?: ReactNode;
}) {
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={title}
        description={description}
        backLink={
          <Link
            to="/tools"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Tools
          </Link>
        }
      />
      {children}
      {error ? (
        <Alert variant="destructive" data-testid="task-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          data-testid="run-task"
          size="lg"
          disabled={!canRun}
          pending={running}
          onClick={onRun}
        >
          {runLabel}
        </Button>
        {footnote ? (
          <span className="text-sm text-muted-foreground">{footnote}</span>
        ) : null}
      </div>
    </AppShell>
  );
}

/** A titled group of a tool's inputs or options. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}
