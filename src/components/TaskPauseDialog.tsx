import { useEffect, useState } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Pause, Play, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { OPEN_END } from '@/lib/schedule';
import { cn } from '@/lib/utils';

const pretty = (key: string) => format(new Date(`${key}T12:00:00`), 'd MMM yyyy');
const endLabel = (end: string) => (end === OPEN_END ? 'until you resume' : `until ${pretty(end)}`);

/**
 * Pause one task -- eggs during a 9-day festival, gym for a month -- while
 * everything else carries on. A paused task is hidden from its days, sends
 * no reminders and can't be missed; its streak, pay and XP stay exactly as
 * they were, so on resume it carries on from the same place.
 */
export function TaskPauseDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { taskPauses, pauseTask, resumeTask, removePause } = useTasks();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [start, setStart] = useState(today);
  const [untilResume, setUntilResume] = useState(true);
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStart(today);
      setUntilResume(true);
      setEnd('');
    }
  }, [open, today]);

  if (!task) return null;

  const mine = taskPauses.filter((r) => r.taskId === task.id && r.end >= today);
  const active = mine.find((r) => today >= r.start && today <= r.end);
  const upcoming = mine.filter((r) => r.start > today);

  const canSubmit = !!start && (untilResume || (!!end && end >= start));

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    await pauseTask(task.id, start, untilResume ? null : end);
    setBusy(false);
    onOpenChange(false);
  };

  const resume = async () => {
    setBusy(true);
    await resumeTask(task.id);
    setBusy(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pause “{task.name}”</DialogTitle>
          <DialogDescription>
            While paused it's hidden from your days, sends no reminders and can't be missed.
            Its streak, pay and XP stay frozen and carry on from the same place when you resume.
          </DialogDescription>
        </DialogHeader>

        {active ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
              <p className="text-sm font-semibold text-foreground">Paused now</p>
              <p className="text-xs text-muted-foreground">
                Since {pretty(active.start)}, {endLabel(active.end)}
              </p>
            </div>
            <Button onClick={resume} disabled={busy} className="w-full gap-2">
              <Play className="w-4 h-4" />
              Resume today
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-pause-start" className="text-xs font-semibold">From</Label>
              <Input id="task-pause-start" type="date" value={start} min={today}
                     onChange={(e) => setStart(e.target.value)} className="h-10" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Until</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: true, label: 'I resume it' },
                  { value: false, label: 'A set date' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setUntilResume(opt.value)}
                    aria-pressed={untilResume === opt.value}
                    className={cn(
                      'h-10 rounded-md border text-sm font-medium transition-colors',
                      untilResume === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {!untilResume && (
                <Input id="task-pause-end" type="date" value={end} min={start || today}
                       aria-label="Last paused day"
                       onChange={(e) => setEnd(e.target.value)} className="h-10" />
              )}
              {!untilResume && (
                <p className="text-xs text-muted-foreground">
                  The last day it stays paused. It's back on the day after.
                </p>
              )}
            </div>

            <Button onClick={submit} disabled={!canSubmit || busy} className="w-full gap-2">
              <Pause className="w-4 h-4" />
              {start === today ? 'Pause from today' : `Pause from ${pretty(start)}`}
            </Button>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold text-muted-foreground">Coming up</p>
            {upcoming.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                <p className="flex-1 min-w-0 text-sm">
                  From {pretty(r.start)}, {endLabel(r.end)}
                </p>
                <Button variant="ghost" size="icon" aria-label="Cancel this pause"
                        onClick={() => removePause(r.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
