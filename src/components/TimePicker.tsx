import { useState, useEffect, useRef, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
}

const ITEM_H = 44; // px — comfortable touch target
const VISIBLE = 5; // odd number so a row is centered
const PAD_ROWS = Math.floor(VISIBLE / 2);
const WHEEL_H = ITEM_H * VISIBLE;

function parseValue(v: string): { h12: number; m: number; period: 'AM' | 'PM' } {
  if (!v || !/^\d{1,2}:\d{2}$/.test(v)) return { h12: 7, m: 0, period: 'AM' };
  const [hStr, mStr] = v.split(':');
  const h24 = Math.max(0, Math.min(23, parseInt(hStr, 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(mStr, 10) || 0));
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return { h12, m, period };
}

function toHHMM(h12: number, m: number, period: 'AM' | 'PM'): string {
  const h24 = period === 'PM' ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
  return `${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

interface WheelProps<T extends number | string> {
  items: T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => string;
  ariaLabel: string;
}

function Wheel<T extends number | string>({ items, value, onChange, render, ariaLabel }: WheelProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<number | undefined>(undefined);
  const suppressChange = useRef(false);

  // Sync scroll position when value changes externally (or on mount)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.max(0, items.indexOf(value));
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 2) {
      suppressChange.current = true;
      el.scrollTop = target;
      // release the guard after the resulting scroll event bubbles
      window.setTimeout(() => { suppressChange.current = false; }, 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items.length]);

  const handleScroll = useCallback(() => {
    if (suppressChange.current) return;
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
      const next = items[idx];
      if (next !== value) onChange(next);
    }, 90);
  }, [items, onChange, value]);

  return (
    <div
      className="relative flex-1 select-none touch-manipulation"
      style={{ height: WHEEL_H }}
      aria-label={ariaLabel}
    >
      {/* Centered highlight band */}
      <div
        className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-lg gradient-primary/20 border border-primary/40 shadow-glow"
        style={{ height: ITEM_H, background: 'hsl(var(--primary) / 0.12)' }}
      />
      {/* Top/bottom fades */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-popover to-transparent z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-popover to-transparent z-10" />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide overscroll-contain"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div style={{ height: ITEM_H * PAD_ROWS }} aria-hidden />
        {items.map((it) => {
          const active = it === value;
          return (
            <div
              key={String(it)}
              onClick={() => onChange(it)}
              className={cn(
                'flex items-center justify-center snap-center cursor-pointer text-lg font-semibold transition-all duration-150',
                active
                  ? 'text-primary scale-110 neon-text-orange'
                  : 'text-muted-foreground/70 active:text-foreground',
              )}
              style={{ height: ITEM_H }}
            >
              {render ? render(it) : String(it)}
            </div>
          );
        })}
        <div style={{ height: ITEM_H * PAD_ROWS }} aria-hidden />
      </div>
    </div>
  );
}

function PickerBody({ value, onDone }: { value: string; onDone: (v?: string) => void }) {
  const initial = parseValue(value);
  const [h12, setH12] = useState(initial.h12);
  const [m, setM] = useState(initial.m);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);
  const [hText, setHText] = useState(String(initial.h12));
  const [mText, setMText] = useState(initial.m.toString().padStart(2, '0'));

  useEffect(() => { setHText(String(h12)); }, [h12]);
  useEffect(() => { setMText(m.toString().padStart(2, '0')); }, [m]);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const commitTypedHour = () => {
    const n = parseInt(hText, 10);
    if (!isNaN(n)) setH12(Math.max(1, Math.min(12, n)));
    else setHText(String(h12));
  };
  const commitTypedMinute = () => {
    const n = parseInt(mText, 10);
    if (!isNaN(n)) setM(Math.max(0, Math.min(59, n)));
    else setMText(m.toString().padStart(2, '0'));
  };

  return (
    <div className="p-4 space-y-4">
      {/* Wheels */}
      <div className="relative flex items-stretch gap-2 rounded-xl bg-secondary/40 border border-border/50 p-2">
        <Wheel<number> ariaLabel="Hour" items={hours} value={h12} onChange={setH12} />
        <div className="self-center text-2xl font-bold text-muted-foreground select-none">:</div>
        <Wheel<number>
          ariaLabel="Minute"
          items={minutes}
          value={m}
          onChange={setM}
          render={(x) => x.toString().padStart(2, '0')}
        />
        <Wheel<'AM' | 'PM'>
          ariaLabel="AM or PM"
          items={['AM', 'PM']}
          value={period}
          onChange={setPeriod}
        />
      </div>

      {/* Type-it fallback */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Hour</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={hText}
            maxLength={2}
            onChange={(e) => setHText(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={commitTypedHour}
            className="w-full h-11 px-3 rounded-lg bg-input border border-border text-center text-base font-semibold focus:border-primary focus:outline-none focus:shadow-glow"
          />
        </div>
        <div className="pb-3 text-xl font-bold text-muted-foreground">:</div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Minute</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={mText}
            maxLength={2}
            onChange={(e) => setMText(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={commitTypedMinute}
            className="w-full h-11 px-3 rounded-lg bg-input border border-border text-center text-base font-semibold focus:border-primary focus:outline-none focus:shadow-glow"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Period</label>
          <div className="flex rounded-lg border border-border overflow-hidden h-11">
            {(['AM', 'PM'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  'flex-1 text-sm font-semibold transition-colors touch-manipulation',
                  period === p
                    ? 'gradient-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground active:bg-secondary/70',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        onClick={() => {
          // Done always commits the current wheel/typed state -- like any
          // ordinary time picker. An earlier version tried to detect whether
          // the user had "really" interacted before committing, to avoid
          // writing the wheels' resting position (7:00 AM, picked by
          // parseValue for an empty value) as a real choice on a field that
          // was never touched. That detection was fragile -- a scroll-driven
          // change is debounced (see handleScroll), so it raced against
          // quick taps -- and it was hiding genuine selections, which is a
          // worse failure than the one it was guarding against. If you don't
          // want a time, use Clear next to the field instead of opening this
          // and tapping Done unchanged.
          const hn = parseInt(hText, 10);
          const mn = parseInt(mText, 10);
          const finalH = !isNaN(hn) ? Math.max(1, Math.min(12, hn)) : h12;
          const finalM = !isNaN(mn) ? Math.max(0, Math.min(59, mn)) : m;
          onDone(toHHMM(finalH, finalM, period));
        }}
        className="w-full h-12 text-base font-semibold"
        size="lg"
      >
        Done
      </Button>
    </div>
  );
}

export function TimePicker({ value, onChange, placeholder = 'Select time' }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const displayValue = value && /^\d{1,2}:\d{2}$/.test(value)
    ? (() => {
        const { h12, m, period } = parseValue(value);
        return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
      })()
    : null;

  const trigger = (
    <Button
      variant="outline"
      className={cn(
        'w-full justify-start text-left font-normal h-11 touch-manipulation',
        !value && 'text-muted-foreground',
      )}
    >
      <Clock className="mr-2 h-4 w-4 text-primary" />
      {displayValue || placeholder}
    </Button>
  );

  const handleDone = (v?: string) => {
    if (v !== undefined) onChange(v);
    setOpen(false);
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DrawerTitle className="sr-only">Pick time</DrawerTitle>
          {/* keyed so state resets when reopened */}
          <PickerBody key={open ? 'open' : 'closed'} value={value} onDone={handleDone} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[340px] max-w-[calc(100vw-1rem)] p-0" align="start">
        <PickerBody key={open ? 'open' : 'closed'} value={value} onDone={handleDone} />
      </PopoverContent>
    </Popover>
  );
}
