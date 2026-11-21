import { NumberField } from "@/client/components/NumberField";
import { ChoiceField } from "@/client/components/ChoiceField";

export interface PageRange {
  all: boolean;
  from: number;
  to: number;
}

/** Every page, or a from–to range. */
export function PageRangeFields({
  value,
  onChange,
  pageCount,
}: {
  value: PageRange;
  onChange: (value: PageRange) => void;
  pageCount: number | null;
}) {
  return (
    <div className="space-y-3">
      <ChoiceField
        label="Pages"
        value={value.all ? "all" : "range"}
        onChange={(choice) =>
          onChange({
            all: choice === "all",
            from: value.from,
            to: choice === "range" && pageCount ? pageCount : value.to,
          })
        }
        options={[
          { value: "all", label: "All pages" },
          { value: "range", label: "Page range" },
        ]}
      />
      {!value.all ? (
        <div className="flex flex-wrap gap-3">
          <NumberField
            label="From page"
            value={value.from}
            onChange={(from) => onChange({ ...value, from })}
          />
          <NumberField
            label="To page"
            value={value.to}
            max={pageCount ?? undefined}
            onChange={(to) => onChange({ ...value, to })}
          />
        </div>
      ) : null}
    </div>
  );
}

export function rangeOptions(range: PageRange) {
  return range.all ? {} : { from: range.from, to: range.to };
}
