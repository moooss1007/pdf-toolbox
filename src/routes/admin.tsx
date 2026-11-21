import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { errorMessage, formatBytes } from "@/client/lib/format";
import { getAdminStats, purgeExpiredNow } from "@/serverFunctions/admin";

export const Route = createFileRoute("/admin")({
  loader: () => getAdminStats(),
  component: AdminPage,
});

function AdminPage() {
  const stats = Route.useLoaderData();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!stats) {
    return (
      <AppShell nav={<AppNav />}>
        <PageHeader title="Admin" />
        <div data-testid="admin-refused">
          <EmptyState
            kind="error"
            title="Only workspace admins can open this page"
          />
        </div>
      </AppShell>
    );
  }

  async function purge() {
    setPending(true);
    try {
      const { deleted } = await purgeExpiredNow();
      toast.success(
        deleted === 1
          ? "1 expired file deleted"
          : `${deleted} expired files deleted`,
      );
      await router.invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const cards = [
    { label: "Members who used it", value: String(stats.members) },
    { label: "Files stored", value: String(stats.files) },
    { label: "Storage used", value: formatBytes(stats.bytes) },
    { label: "Tasks in the last two hours", value: String(stats.tasks) },
  ];

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Admin" description="Totals for the whole workspace." />
      <div className="grid gap-3 sm:grid-cols-2" data-testid="admin-stats">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {card.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Expired files</CardTitle>
          <CardDescription>
            {stats.expiredWaiting === 0
              ? "None waiting."
              : `${stats.expiredWaiting} waiting for the next cleanup, which runs every ten minutes.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            pending={pending}
            disabled={stats.expiredWaiting === 0}
            onClick={() => void purge()}
          >
            Delete expired files now
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
