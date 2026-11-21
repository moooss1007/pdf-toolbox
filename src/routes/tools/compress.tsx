import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChoiceField } from "@/client/components/ChoiceField";
import { FilePicker } from "@/client/components/FilePicker";
import { Section, ToolPage } from "@/client/components/ToolPage";
import { useRunTask } from "@/client/hooks/useRunTask";
import { getFiles } from "@/serverFunctions/files";

export const Route = createFileRoute("/tools/compress")({
  loader: () => getFiles({ data: {} }),
  component: CompressPage,
});

function CompressPage() {
  const files = Route.useLoaderData();
  const [picked, setPicked] = useState<string[]>([]);
  const [level, setLevel] = useState<"basic" | "strong">("strong");
  const task = useRunTask();
  return (
    <ToolPage
      title="Compress PDF"
      description="Make a PDF smaller."
      runLabel="Compress"
      canRun={picked.length === 1}
      running={task.running}
      error={task.error}
      onRun={() =>
        void task.run({ tool: "compress", inputs: picked, options: { level } })
      }
    >
      <Section title="PDF">
        <FilePicker
          files={files}
          kind="pdf"
          selected={picked}
          onChange={setPicked}
        />
      </Section>
      <ChoiceField
        label="Level"
        value={level}
        onChange={setLevel}
        options={[
          { value: "basic", label: "Basic" },
          { value: "strong", label: "Strong: also removes metadata" },
        ]}
      />
    </ToolPage>
  );
}
