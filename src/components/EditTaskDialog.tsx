import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTasks } from '@/contexts/TaskContext';
import { Task, FrequencyType, DayOfWeek, DAYS_OF_WEEK, DIFFICULTY_MULTIPLIERS } from '@/types/task';
import { TRAITS, TraitId, isTraitId } from '@/lib/xpUtils';
import { HelpCircle, Clock } from 'lucide-react';
import { TimePicker } from './TimePicker';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface EditTaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTaskDialog({ task, open, onOpenChange }: EditTaskDialogProps) {
  const { updateTask } = useTasks();
  const [name, setName] = useState('');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('weekly');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedMonthDays, setSelectedMonthDays] = useState<number[]>([]);
  const [specificDay, setSpecificDay] = useState<DayOfWeek>('monday');
  const [minDaysWeek, setMinDaysWeek] = useState('3');
  const [minDaysMonth, setMinDaysMonth] = useState('10');
  const [amount, setAmount] = useState('');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [scheduledTime, setScheduledTime] = useState('');
  const [traits, setTraits] = useState<TraitId[]>(['discipline']);

  useEffect(() => {
    if (task) {
      setName(task.name);
      setFrequencyType(task.frequencyType);
      setAmount(task.baseAmount.toString());
      setDifficulty(task.difficulty);
      setScheduledTime(task.scheduledTime || '');
      setTraits(task.traits && task.traits.length > 0 ? task.traits : ['discipline']);

      if (task.frequencyType === 'weekly') {
        setSelectedDays(task.frequencyValue as number[]);
      } else if (task.frequencyType === 'monthly') {
        setSelectedMonthDays(task.frequencyValue as number[]);
      } else if (task.frequencyType === 'specific-day') {
        setSpecificDay(task.frequencyValue as DayOfWeek);
      } else if (task.frequencyType === 'at-least-weekly') {
        setMinDaysWeek((task.frequencyValue as number).toString());
      } else if (task.frequencyType === 'at-least-monthly') {
        setMinDaysMonth((task.frequencyValue as number).toString());
      }
    }
  }, [task]);

  const handleSubmit = async () => {
    if (!task || !name.trim() || !amount) return;

    let frequencyValue: number[] | string | DayOfWeek | number;
    switch (frequencyType) {
      case 'weekly':
        frequencyValue = selectedDays;
        break;
      case 'monthly':
        frequencyValue = selectedMonthDays;
        break;
      case 'specific-day':
        frequencyValue = specificDay;
        break;
      case 'at-least-weekly':
        frequencyValue = parseInt(minDaysWeek) || 3;
        break;
      case 'at-least-monthly':
        frequencyValue = parseInt(minDaysMonth) || 10;
        break;
      default:
        frequencyValue = task.frequencyValue;
    }

    await updateTask(task.id, {
      name: name.trim(),
      frequencyType,
      frequencyValue,
      baseAmount: parseFloat(amount),
      difficulty,
      scheduledTime: scheduledTime || null,
      traits: traits.length > 0 ? traits : ['discipline'],
    });

    onOpenChange(false);
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleMonthDay = (day: number) => {
    setSelectedMonthDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const weekDays = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Edit Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-sm font-semibold">Task Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Exercise"
              className="h-11"
            />
          </div>

          {/* Frequency Type */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Frequency</Label>
            <Select value={frequencyType} onValueChange={(v) => setFrequencyType(v as FrequencyType)}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Specific Days in a Week</SelectItem>
                <SelectItem value="at-least-weekly">At Least X Days a Week</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Frequency Value based on type */}
          {frequencyType === 'weekly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Select Days</Label>
              <div className="flex gap-2 flex-wrap">
                {weekDays.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      'w-12 h-10 rounded-lg text-sm font-medium transition-all',
                      selectedDays.includes(day.value)
                        ? 'gradient-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequencyType === 'monthly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Select Days of Month</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleMonthDay(day)}
                    className={cn(
                      'w-9 h-9 rounded-md text-xs font-medium transition-all',
                      selectedMonthDays.includes(day)
                        ? 'gradient-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequencyType === 'at-least-weekly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Minimum Days per Week</Label>
              <Select value={minDaysWeek} onValueChange={setMinDaysWeek}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <SelectItem key={n} value={n.toString()}>At least {n} day{n > 1 ? 's' : ''} per week</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {frequencyType === 'at-least-monthly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Minimum Days per Month</Label>
              <Select value={minDaysMonth} onValueChange={setMinDaysMonth}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 25, 30].map((n) => (
                    <SelectItem key={n} value={n.toString()}>At least {n} days per month</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {frequencyType === 'specific-day' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Select Day</Label>
              <Select value={specificDay} onValueChange={(v) => setSpecificDay(v as DayOfWeek)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day} value={day} className="capitalize">
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Base Amount */}
          <div className="space-y-2">
            <Label htmlFor="edit-amount" className="text-sm font-semibold">Base Amount (₹)</Label>
            <Input
              id="edit-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 50"
              className="h-11"
              min="0"
              step="0.01"
            />
            <p className="text-xs text-muted-foreground">Changing base amount will recalculate current pay based on streaks</p>
          </div>

          {/* Scheduled Time */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Scheduled Time (optional)</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <TimePicker value={scheduledTime} onChange={setScheduledTime} />
              </div>
              {scheduledTime && (
                <Button variant="ghost" size="sm" onClick={() => setScheduledTime('')} className="h-11 text-muted-foreground">
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Traits (multi-select) */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Traits</Label>
            <div className="flex flex-wrap gap-2">
              {TRAITS.map((t) => {
                const active = traits.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setTraits((prev) =>
                        prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                      )
                    }
                    className={cn(
                      'px-3 h-9 rounded-lg text-sm font-medium border transition-all',
                      active
                        ? 'gradient-primary text-primary-foreground border-transparent shadow-glow'
                        : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
                    )}
                  >
                    <span className="mr-1">{t.emoji}</span>{t.name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Full XP awarded to every selected trait.</p>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Difficulty</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-2">Weekly Streak Multipliers:</p>
                  <div className="space-y-1 text-sm">
                    <p>Difficulty 1 → 1.5x</p>
                    <p>Difficulty 2 → 2x</p>
                    <p>Difficulty 3 → 2.5x</p>
                    <p>Difficulty 4 → 3x</p>
                    <p>Difficulty 5 → 4x</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    'flex-1 h-11 rounded-lg text-sm font-semibold transition-all',
                    difficulty === d
                      ? 'gradient-primary text-primary-foreground shadow-glow'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Streak bonus: {DIFFICULTY_MULTIPLIERS[difficulty]}x multiplier
            </p>
          </div>

          {/* Submit */}
          <Button onClick={handleSubmit} className="w-full" size="lg" disabled={!name.trim() || !amount}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
