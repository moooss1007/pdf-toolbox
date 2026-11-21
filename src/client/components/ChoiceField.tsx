import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Label } from "@/client/components/ui/label";

/** A labelled single choice between a few named options. */
export function ChoiceField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap">
        <SegmentedToggle
          showLabels
          value={value}
          onChange={onChange}
          items={options.map((option) => ({ ...option, icon: null }))}
        />
      </div>
    </div>
  );
}
