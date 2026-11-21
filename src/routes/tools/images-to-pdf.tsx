import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChoiceField } from "@/client/components/ChoiceField";
import { FilePicker } from "@/client/components/FilePicker";
import { OrderedFiles } from "@/client/components/OrderedFiles";
import { Section, ToolPage } from "@/client/components/ToolPage";
import { useRunTask } from "@/client/hooks/useRunTask";
import { getFiles } from "@/serverFunctions/files";

export const Route = createFileRoute("/tools/images-to-pdf")({
  loader: () => getFiles({ data: {} }),
  component: ImagesToPdfPage,
});

function ImagesToPdfPage() {
  const files = Route.useLoaderData();
  const [order, setOrder] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<"fit" | "a4" | "letter">("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "portrait",
  );
  const [margin, setMargin] = useState<"none" | "small" | "big">("none");
  const [oneFile, setOneFile] = useState<"one" | "each">("one");
  const task = useRunTask();

  return (
    <ToolPage
      title="Images to PDF"
      description="Turn JPG and PNG images into PDF pages."
      runLabel="Convert"
      canRun={order.length > 0}
      running={task.running}
      error={task.error}
      onRun={() =>
        void task.run({
          tool: "images-to-pdf",
          inputs: order,
          options: {
            pageSize,
            orientation,
            margin,
            oneFile: oneFile === "one",
          },
        })
      }
    >
      <Section title="Images">
        <FilePicker
          files={files}
          kind="image"
          multiple
          selected={order}
          onChange={setOrder}
        />
      </Section>
      <OrderedFiles files={files} order={order} onChange={setOrder} />
      <ChoiceField
        label="Page size"
        value={pageSize}
        onChange={setPageSize}
        options={[
          { value: "fit", label: "Same as image" },
          { value: "a4", label: "A4" },
          { value: "letter", label: "US Letter" },
        ]}
      />
      {pageSize !== "fit" ? (
        <ChoiceField
          label="Orientation"
          value={orientation}
          onChange={setOrientation}
          options={[
            { value: "portrait", label: "Portrait" },
            { value: "landscape", label: "Landscape" },
          ]}
        />
      ) : null}
      <ChoiceField
        label="Margin"
        value={margin}
        onChange={setMargin}
        options={[
          { value: "none", label: "None" },
          { value: "small", label: "Small" },
          { value: "big", label: "Big" },
        ]}
      />
      <ChoiceField
        label="Output"
        value={oneFile}
        onChange={setOneFile}
        options={[
          { value: "one", label: "One PDF" },
          { value: "each", label: "One PDF per image" },
        ]}
      />
    </ToolPage>
  );
}
