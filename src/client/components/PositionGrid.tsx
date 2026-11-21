import { cn } from "cn";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";

const ROWS = ["top", "middle", "bottom"] as const;
const COLUMNS = ["left", "center", "right"] as const;

/** Pick one of nine spots on the page; `rows` limits it to, say, top and bottom. */
export function PositionGrid({
  label,
  value,
  onChange,
  rows = ROWS,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: readonly (typeof ROWS)[number][];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid w-fit grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1">
        {rows.flatMap((row) =>
          COLUMNS.map((column) => {
            const spot = `${row}-${column}`;
            const on = value === spot;
            return (
              <Button
                key={spot}
                size="icon-sm"
                variant={on ? "default" : "ghost"}
                aria-label={spot.replace("-", " ")}
                aria-pressed={on}
                onClick={() => onChange(spot)}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    on ? "bg-primary-foreground" : "bg-muted-foreground/50",
                  )}
                />
              </Button>
            );
          }),
        )}
      </div>
    </div>
  );
}
