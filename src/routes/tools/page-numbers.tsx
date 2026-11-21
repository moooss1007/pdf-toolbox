import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChoiceField } from "@/client/components/ChoiceField";
import { FilePicker } from "@/client/components/FilePicker";
import { NumberField } from "@/client/components/NumberField";
import {
  PageRangeFields,
  rangeOptions,
  type PageRange,
} from "@/client/components/PageRangeFields";
import { PositionGrid } from "@/client/components/PositionGrid";
import { Section, ToolPage } from "@/client/components/ToolPage";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { useRunTask } from "@/client/hooks/useRunTask";
import { getFiles } from "@/serverFunctions/files";

export const Route = createFileRoute("/tools/page-numbers")({
  loader: () => getFiles({ data: {} }),
  component: PageNumbersPage,
});

type Template = "n" | "page-n" | "page-n-of-p" | "custom";

function PageNumbersPage() {
  const files = Route.useLoaderData();
  const [picked, setPicked] = useState<string[]>([]);
  const [spot, setSpot] = useState("bottom-center");
  const [margin, setMargin] = useState<"small" | "medium" | "large">("medium");
  const [start, setStart] = useState(1);
  const [skipFirst, setSkipFirst] = useState(false);
  const [template, setTemplate] = useState<Template>("n");
  const [custom, setCustom] = useState("{n} / {p}");
  const [fontSize, setFontSize] = useState(11);
  const [range, setRange] = useState<PageRange>({ all: true, from: 1, to: 1 });
  const task = useRunTask();
  const pdf = files.find((f) => f.id === picked[0]);
  const [vertical, horizontal] = spot.split("-") as [
    "top" | "bottom",
    "left" | "center" | "right",
  ];

  return (
    <ToolPage
      title="Page numbers"
      description="Number the pages of a PDF."
      runLabel="Add numbers"
      canRun={
        Boolean(pdf) && (template !== "custom" || custom.trim().length > 0)
      }
      running={task.running}
      error={task.error}
      onRun={() =>
        void task.run({
          tool: "page-numbers",
          inputs: picked,
          options: {
            vertical,
            horizontal,
            margin,
            start,
            skipFirst,
            template,
            custom,
            fontSize,
            ...rangeOptions(range),
          },
        })
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
      <PositionGrid
        label="Position"
        value={spot}
        onChange={setSpot}
        rows={["top", "bottom"]}
      />
      <ChoiceField
        label="Margin"
        value={margin}
        onChange={setMargin}
        options={[
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ]}
      />
      <div className="flex flex-wrap items-end gap-4">
        <NumberField
          label="First number"
          value={start}
          min={0}
          onChange={setStart}
        />
        <NumberField
          label="Font size"
          value={fontSize}
          min={6}
          max={72}
          suffix="pt"
          onChange={setFontSize}
        />
      </div>
      <PageRangeFields
        value={range}
        onChange={setRange}
        pageCount={pdf?.pageCount ?? null}
      />
      <div className="flex items-center gap-2">
        <Switch
          id="skip-first"
          checked={skipFirst}
          onCheckedChange={setSkipFirst}
        />
        <Label htmlFor="skip-first">First page is a cover (no number)</Label>
      </div>
      <ChoiceField
        label="Text"
        value={template}
        onChange={setTemplate}
        options={[
          { value: "n", label: "3" },
          { value: "page-n", label: "Page 3" },
          { value: "page-n-of-p", label: "Page 3 of 10" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {template === "custom" ? (
        <div className="max-w-md space-y-2">
          <Label htmlFor="custom-text">Custom text</Label>
          <Input
            id="custom-text"
            value={custom}
            maxLength={200}
            onChange={(e) => setCustom(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {"{n}"} is the page number, {"{p}"} the last number.
          </p>
        </div>
      ) : null}
    </ToolPage>
  );
}
