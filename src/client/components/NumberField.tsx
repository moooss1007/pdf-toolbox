import { Input } from "@/client/components/ui/input";

/** A labelled whole-number input. */
export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          className="w-24"
          value={Number.isFinite(value) ? value : ""}
          onChange={(event) => onChange(event.target.valueAsNumber)}
        />
        {suffix ? (
          <span className="text-sm text-muted-foreground">{suffix}</span>
        ) : null}
      </span>
    </label>
  );
}
