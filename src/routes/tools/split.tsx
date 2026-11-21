import { createFileRoute } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ChoiceField } from "@/client/components/ChoiceField";
import { FilePicker } from "@/client/components/FilePicker";
import { Section, ToolPage } from "@/client/components/ToolPage";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { NumberField } from "@/client/components/NumberField";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { useRunTask } from "@/client/hooks/useRunTask";
import { splitGroups, type SplitOptions } from "@/server/pdf/pages";
import { getFiles } from "@/serverFunctions/files";

export const Route = createFileRoute("/tools/split")({
  loader: () => getFiles({ data: {} }),
  component: SplitPage,
});

type Mode = "ranges" | "fixed" | "extract";

function SplitPage() {
  const files = Route.useLoaderData();
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState([{ from: 1, to: 1 }]);
  const [mergeRanges, setMergeRanges] = useState(false);
  const [every, setEvery] = useState(1);
  const [extractAll, setExtractAll] = useState<"all" | "some">("all");
  const [pageList, setPageList] = useState("");
  const task = useRunTask();

  const file = files.find((f) => f.id === picked[0]);
  const pageCount = file?.pageCount ?? 0;
  const options: SplitOptions =
    mode === "ranges"
      ? { mode, ranges, mergeRanges }
      : mode === "fixed"
        ? { mode, every }
        : { mode, pages: extractAll === "all" ? "all" : pageList };

  let preview: string | null = null;
  let problem: string | null = null;
  if (file) {
    try {
      const count = splitGroups(options, pageCount).length;
      preview =
        count === 1 ? "1 PDF will be created" : `${count} PDFs will be created`;
    } catch (error) {
      problem = error instanceof Error ? error.message : null;
    }
  }

  return (
    <ToolPage
      title="Split PDF"
      description="Cut a PDF into page ranges, or pull pages out into their own files."
      runLabel="Split"
      canRun={Boolean(file) && !problem}
      running={task.running}
      error={task.error ?? problem}
      onRun={() => void task.run({ tool: "split", inputs: picked, options })}
      footnote={<span data-testid="split-preview">{preview}</span>}
    >
      <Section title="PDF">
        <FilePicker
          files={files}
          kind="pdf"
          selected={picked}
          onChange={(ids) => {
            setPicked(ids);
            const count = files.find((f) => f.id === ids[0])?.pageCount ?? 1;
            setRanges([{ from: 1, to: count }]);
          }}
        />
      </Section>
      <ChoiceField
        label="Split by"
        value={mode}
        onChange={setMode}
        options={[
          { value: "ranges", label: "Custom ranges" },
          { value: "fixed", label: "Every N pages" },
          { value: "extract", label: "Extract pages" },
        ]}
      />
      {mode === "ranges" ? (
        <div className="space-y-3">
          {ranges.map((range, index) => (
            <div
              key={index}
              className="flex flex-wrap items-end gap-3"
              data-testid="range-row"
            >
              <span className="w-16 pb-2 text-sm text-muted-foreground">
                Range {index + 1}
              </span>
              <NumberField
                label="From page"
                value={range.from}
                onChange={(from) =>
                  setRanges(
                    ranges.map((r, i) => (i === index ? { ...r, from } : r)),
                  )
                }
              />
              <NumberField
                label="To page"
                value={range.to}
                onChange={(to) =>
                  setRanges(
                    ranges.map((r, i) => (i === index ? { ...r, to } : r)),
                  )
                }
              />
              {ranges.length > 1 ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove range ${index + 1}`}
                  onClick={() =>
                    setRanges(ranges.filter((_, i) => i !== index))
                  }
                >
                  <X />
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const last = ranges[ranges.length - 1];
              const from = Math.min(
                (last?.to ?? 0) + 1,
                Math.max(pageCount, 1),
              );
              setRanges([...ranges, { from, to: Math.max(from, pageCount) }]);
            }}
          >
            <Plus />
            Add range
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              id="merge-ranges"
              checked={mergeRanges}
              onCheckedChange={setMergeRanges}
            />
            <Label htmlFor="merge-ranges">Merge all ranges into one PDF</Label>
          </div>
        </div>
      ) : mode === "fixed" ? (
        <NumberField label="Pages per file" value={every} onChange={setEvery} />
      ) : (
        <div className="space-y-3">
          <ChoiceField
            label="Pages"
            value={extractAll}
            onChange={setExtractAll}
            options={[
              { value: "all", label: "Every page" },
              { value: "some", label: "Chosen pages" },
            ]}
          />
          {extractAll === "some" ? (
            <div className="max-w-xs space-y-2">
              <Label htmlFor="page-list">Pages to extract</Label>
              <Input
                id="page-list"
                placeholder="1, 3, 5-8"
                value={pageList}
                onChange={(event) => setPageList(event.target.value)}
              />
            </div>
          ) : null}
        </div>
      )}
    </ToolPage>
  );
}
