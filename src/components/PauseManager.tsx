import { useState } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import { Palmtree, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const pretty = (key: string) => format(new Date(`${key}T12:00:00`), 'd MMM yyyy');

/**
 * Vacation windows. Inside one, every task is off the hook: nothing shows on
 * the day and no streak breaks, so one holiday can't wipe out every habit.
 */
export function PauseManager({ trigger }: { trigger?: React.ReactNode }) {
  const { pauseRanges, addPause, removePause } = useTasks();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [label, setLabel] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');

  const submit = async () => {
    if (!start || !end) return;
    await addPause(start, end, label.trim() || undefined);
    setStart('');
    setEnd('');
    setLabel('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <Palmtree className="w-4 h-4" />
            Vacation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vacation &amp; pauses</DialogTitle>
          <DialogDescription>
            Tasks are hidden and streaks are protected on every day inside a pause.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="pause-start" className="text-xs font-semibold">From</Label>
              <Input id="pause-start" type="date" value={start} min="2000-01-01"
                     onChange={(e) => setStart(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pause-end" className="text-xs font-semibold">To</Label>
              <Input id="pause-end" type="date" value={end} min={start || undefined}
                     onChange={(e) => setEnd(e.target.value)} className="h-10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pause-label" className="text-xs font-semibold">Reason (optional)</Label>
            <Input id="pause-label" value={label} placeholder="Trip home"
                   onChange={(e) => setLabel(e.target.value)} className="h-10" />
          </div>
          <Button onClick={submit} disabled={!start || !end} className="w-full">
            Add pause
          </Button>
        </div>

        <div className="space-y-2 pt-2">
          {pauseRanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pauses yet.</p>
          ) : (
            pauseRanges.map((r) => {
              const active = today >= r.start && today <= r.end;
              return (
                <div key={r.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.label || 'Pause'}
                      {active && <span className="ml-2 text-xs text-primary font-semibold">active now</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pretty(r.start)} – {pretty(r.end)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remove pause"
                          onClick={() => removePause(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
