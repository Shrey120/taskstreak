import { cn } from '@/lib/utils';

/** Day values follow JS `getDay()`: 0 = Sunday ... 6 = Saturday. */
const PRESETS: { label: string; days: number[] }[] = [
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekends', days: [0, 6] },
];

const sameDays = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  const x = [...a].sort((m, n) => m - n);
  const y = [...b].sort((m, n) => m - n);
  return x.every((d, i) => d === y[i]);
};

interface DayPresetChipsProps {
  selected: number[];
  onSelect: (days: number[]) => void;
}

/**
 * One-tap shortcuts above the seven day toggles. Applying a preset replaces
 * the selection outright; the chip lights up whenever the current selection
 * already matches it, including after the user builds it by hand.
 */
export function DayPresetChips({ selected, onSelect }: DayPresetChipsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PRESETS.map((preset) => {
        const active = sameDays(selected, preset.days);
        return (
          <button
            key={preset.label}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(preset.days)}
            className={cn(
              'h-7 px-2.5 rounded-full border text-xs font-medium transition-all',
              active
                ? 'gradient-primary text-primary-foreground border-transparent'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
