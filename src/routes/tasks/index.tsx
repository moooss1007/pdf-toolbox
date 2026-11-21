import { Link, createFileRoute } from "@tanstack/react-router";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { timeLeft } from "@/client/lib/format";
import { TOOL_NAMES } from "@/client/lib/toolNames";
import { getTasks } from "@/serverFunctions/tasks";

export const Route = createFileRoute("/tasks/")({
  loader: () => getTasks(),
  component: HistoryPage,
});

function HistoryPage() {
  const tasks = Route.useLoaderData();
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="History" />
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Results from the tools appear here for two hours."
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
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                to="/tasks/$id"
                params={{ id: task.id }}
                data-testid="task-row"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="w-32 shrink-0 text-sm font-medium">
                  {TOOL_NAMES[task.tool] ?? task.tool}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {task.inputs.map((input) => input.name).join(", ")}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">
                  {timeLeft(task.expiresAt)} left
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
