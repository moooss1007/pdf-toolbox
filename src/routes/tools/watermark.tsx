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
import { useRunTask } from "@/client/hooks/useRunTask";
import { getFiles } from "@/serverFunctions/files";

export const Route = createFileRoute("/tools/watermark")({
  loader: () => getFiles({ data: {} }),
  component: WatermarkPage,
});

type Spot = `${"top" | "middle" | "bottom"}-${"left" | "center" | "right"}`;

function WatermarkPage() {
  const files = Route.useLoaderData();
  const [picked, setPicked] = useState<string[]>([]);
  const [type, setType] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#d03030");
  const [image, setImage] = useState<string[]>([]);
  const [opacity, setOpacity] = useState(50);
  const [rotation, setRotation] = useState(45);
  const [placement, setPlacement] = useState<"spot" | "tiled">("spot");
  const [spot, setSpot] = useState<Spot>("middle-center");
  const [layer, setLayer] = useState<"over" | "under">("over");
  const [range, setRange] = useState<PageRange>({ all: true, from: 1, to: 1 });
  const task = useRunTask();
  const pdf = files.find((f) => f.id === picked[0]);

  const common = {
    opacity: opacity / 100,
    rotation,
    position: placement === "tiled" ? ("tiled" as const) : spot,
    layer,
    ...rangeOptions(range),
  };
  const ready =
    Boolean(pdf) &&
    (type === "text" ? text.trim().length > 0 : image.length === 1);

  return (
    <ToolPage
      title="Watermark"
      description="Stamp text or an image across the pages of a PDF."
      runLabel="Add watermark"
      canRun={ready}
      running={task.running}
      error={task.error}
      onRun={() =>
        void task.run({
          tool: "watermark",
          inputs: picked,
          options:
            type === "text"
              ? { type, text, fontSize, color, ...common }
              : { type, imageId: image[0]!, ...common },
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
      <ChoiceField
        label="Stamp"
        value={type}
        onChange={setType}
        options={[
          { value: "text", label: "Text" },
          { value: "image", label: "Image" },
        ]}
      />
      {type === "text" ? (
        <div className="space-y-4">
          <div className="max-w-md space-y-2">
            <Label htmlFor="wm-text">Text</Label>
            <Input
              id="wm-text"
              value={text}
              maxLength={200}
              placeholder="DRAFT"
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <NumberField
              label="Font size"
              value={fontSize}
              min={6}
              max={200}
              suffix="pt"
              onChange={setFontSize}
            />
            <label className="space-y-2">
              <span className="block text-sm font-medium">Colour</span>
              <Input
                type="color"
                className="h-9 w-16 p-1"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>
        </div>
      ) : (
        <Section title="Image">
          <FilePicker
            files={files}
            kind="image"
            selected={image}
            onChange={setImage}
          />
        </Section>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <NumberField
          label="Opacity"
          value={opacity}
          min={5}
          max={100}
          suffix="%"
          onChange={setOpacity}
        />
        <NumberField
          label="Rotation"
          value={rotation}
          min={-360}
          max={360}
          step={15}
          suffix="°"
          onChange={setRotation}
        />
      </div>
      <ChoiceField
        label="Placement"
        value={placement}
        onChange={setPlacement}
        options={[
          { value: "spot", label: "One position" },
          { value: "tiled", label: "Tiled" },
        ]}
      />
      {placement === "spot" ? (
        <PositionGrid
          label="Position"
          value={spot}
          onChange={(s) => setSpot(s as Spot)}
        />
      ) : null}
      <PageRangeFields
        value={range}
        onChange={setRange}
        pageCount={pdf?.pageCount ?? null}
      />
      <ChoiceField
        label="Layer"
        value={layer}
        onChange={setLayer}
        options={[
          { value: "over", label: "Over the content" },
          { value: "under", label: "Under the content" },
        ]}
      />
    </ToolPage>
  );
}
