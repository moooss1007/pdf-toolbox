import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FilePicker } from "@/client/components/FilePicker";
import { OrderedFiles } from "@/client/components/OrderedFiles";
import { Section, ToolPage } from "@/client/components/ToolPage";
import { useRunTask } from "@/client/hooks/useRunTask";
import { getFiles } from "@/serverFunctions/files";

export const Route = createFileRoute("/tools/merge")({
  loader: () => getFiles({ data: {} }),
  component: MergePage,
});

function MergePage() {
  const files = Route.useLoaderData();
  const [order, setOrder] = useState<string[]>([]);
  const task = useRunTask();
  return (
    <ToolPage
      title="Merge PDFs"
      description="Join two or more PDFs into one."
      runLabel="Merge"
      canRun={order.length >= 2}
      running={task.running}
      error={task.error}
      onRun={() => void task.run({ tool: "merge", inputs: order, options: {} })}
    >
      <Section title="PDFs">
        <FilePicker
          files={files}
          kind="pdf"
          multiple
          selected={order}
          onChange={setOrder}
        />
      </Section>
      <OrderedFiles files={files} order={order} onChange={setOrder} />
    </ToolPage>
  );
}
