import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTasks } from '@/contexts/TaskContext';
import { Task, FrequencyType, DayOfWeek, DAYS_OF_WEEK, DIFFICULTY_MULTIPLIERS, Subtask } from '@/types/task';
import { TRAITS, TraitId, isTraitId, baseXpForEffort } from '@/lib/xpUtils';
import { HelpCircle, Clock, Plus, X, ListChecks } from 'lucide-react';
import { TimePicker } from './TimePicker';
import { cn } from '@/lib/utils';
import { DayPresetChips } from './DayPresetChips';
import { WeeklyLoadPreview } from './WeeklyLoadPreview';
import { isEveryNWeeksValue } from '@/lib/schedule';
import { toKey, weekStartKey } from '@/lib/periodUtils';
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
  const [effortWeight, setEffortWeight] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [scheduledTime, setScheduledTime] = useState('');
  const [weekInterval, setWeekInterval] = useState('2');
  const [weekAnchor, setWeekAnchor] = useState<string | null>(null);
  const [traits, setTraits] = useState<TraitId[]>(['discipline']);
  const [isHourly, setIsHourly] = useState(false);
  const [perMinuteRate, setPerMinuteRate] = useState('');
  const [hasSubtasks, setHasSubtasks] = useState(false);
  // `id` present = an existing row to keep/update; absent = a new one to insert.
  const [subtaskItems, setSubtaskItems] = useState<{ id?: string; name: string; scheduledTime: string }[]>([]);
  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [newSubtaskTime, setNewSubtaskTime] = useState('');

  useEffect(() => {
    if (task) {
      setName(task.name);
      setFrequencyType(task.frequencyType);
      setAmount(task.baseAmount.toString());
      setDifficulty(task.difficulty);
      setEffortWeight(task.effortWeight ?? task.difficulty);
      setScheduledTime(task.scheduledTime || '');
      setTraits(task.traits && task.traits.length > 0 ? task.traits : ['discipline']);
      setIsHourly(task.isHourly);
      setPerMinuteRate(task.isHourly ? task.perMinuteRate.toString() : '');
      setHasSubtasks(task.subtasks.length > 0);
      setSubtaskItems(task.subtasks.map((s) => ({ id: s.id, name: s.name, scheduledTime: s.scheduledTime })));
      setNewSubtaskName('');
      setNewSubtaskTime('');

      if (task.frequencyType === 'weekly') {
        setSelectedDays(task.frequencyValue as number[]);
      } else if (task.frequencyType === 'monthly') {
        setSelectedMonthDays(task.frequencyValue as number[]);
      } else if (task.frequencyType === 'every-n-weeks') {
        const v = task.frequencyValue;
        if (isEveryNWeeksValue(v)) {
          setWeekInterval(String(v.interval));
          setSelectedDays(v.days);
          // Keep the original anchor so editing doesn't shift which weeks are on.
          setWeekAnchor(v.anchor);
        }
      } else if (task.frequencyType === 'specific-day') {
        setSpecificDay(task.frequencyValue as DayOfWeek);
      } else if (task.frequencyType === 'at-least-weekly') {
        setMinDaysWeek((task.frequencyValue as number).toString());
      } else if (task.frequencyType === 'at-least-monthly') {
        setMinDaysMonth((task.frequencyValue as number).toString());
      }
    }
  }, [task]);

  const addSubtask = () => {
    if (newSubtaskName.trim() && newSubtaskTime) {
      setSubtaskItems((prev) => [...prev, { name: newSubtaskName.trim(), scheduledTime: newSubtaskTime }]);
      setNewSubtaskName('');
      setNewSubtaskTime('');
    }
  };

  const removeSubtask = (index: number) => {
    setSubtaskItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!task || !name.trim() || (isHourly ? !perMinuteRate : !amount)) return;
    if (hasSubtasks && subtaskItems.length === 0) return;

    let frequencyValue: Task['frequencyValue'];
    switch (frequencyType) {
      case 'weekly':
        frequencyValue = selectedDays;
        break;
      case 'monthly':
        frequencyValue = selectedMonthDays;
        break;
      case 'every-n-weeks':
        frequencyValue = {
          interval: Math.max(1, parseInt(weekInterval, 10) || 2),
          days: selectedDays,
          anchor: weekAnchor ?? weekStartKey(toKey(new Date())),
        };
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
      // Matches CreateTaskDialog's convention: an hourly task carries no
      // fixed amount, and its difficulty/effort are fixed rather than
      // user-set, since its raise is a flat +₹0.50/min rather than a
      // difficulty-scaled multiplier.
      baseAmount: isHourly ? 0 : parseFloat(amount),
      difficulty: isHourly ? 1 : difficulty,
      effortWeight: isHourly ? 3 : effortWeight,
      isHourly,
      perMinuteRate: isHourly ? parseFloat(perMinuteRate) : 0,
      scheduledTime: scheduledTime || null,
      traits: traits.length > 0 ? traits : ['discipline'],
      // Always sent, even as []: an empty list here means "delete every
      // remaining subtask", which is exactly what turning the toggle off
      // should do.
      subtasks: hasSubtasks ? subtaskItems : [],
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
                <SelectItem value="every-n-weeks">Every N Weeks on Selected Days</SelectItem>
                <SelectItem value="at-least-weekly">At Least X Days a Week</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Frequency Value based on type */}
          {frequencyType === 'weekly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Select Days</Label>
              <DayPresetChips selected={selectedDays} onSelect={setSelectedDays} />
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
              <div className="pt-1">
                <WeeklyLoadPreview selectedDays={selectedDays} excludeTaskId={task?.id} />
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

          {frequencyType === 'every-n-weeks' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Repeat every</Label>
              <Select value={weekInterval} onValueChange={setWeekInterval}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 6, 8].map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n} weeks</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="text-sm font-semibold pt-2 block">On these days</Label>
              <DayPresetChips selected={selectedDays} onSelect={setSelectedDays} />
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

          {/* Hourly Task Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="space-y-0.5">
              <Label htmlFor="edit-hourly-mode" className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Hourly Task
              </Label>
              <p className="text-xs text-muted-foreground">Pay based on time worked (per minute)</p>
            </div>
            <Switch
              id="edit-hourly-mode"
              checked={isHourly}
              onCheckedChange={setIsHourly}
            />
          </div>

          {isHourly ? (
            /* Per Minute Rate for Hourly Tasks */
            <div className="space-y-2">
              <Label htmlFor="edit-perMinuteRate" className="text-sm font-semibold">Rate per Minute (₹)</Label>
              <Input
                id="edit-perMinuteRate"
                type="number"
                value={perMinuteRate}
                onChange={(e) => setPerMinuteRate(e.target.value)}
                placeholder="e.g., 1.5"
                className="h-11"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Rate increases by ₹0.50 after completing a 7-day streak
              </p>
            </div>
          ) : (
            /* Base Amount */
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
          )}

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

          {!isHourly && (
          <>
          {/* Difficulty */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Difficulty</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="p-3">
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
              Streak bonus: {DIFFICULTY_MULTIPLIERS[difficulty]}x multiplier. Drives money only.
            </p>
          </div>

          {/* Effort — XP only */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Effort</Label>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEffortWeight(e)}
                  className={cn(
                    'flex-1 h-11 rounded-lg text-sm font-semibold transition-all',
                    effortWeight === e
                      ? 'gradient-primary text-primary-foreground shadow-glow'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {baseXpForEffort(effortWeight)} XP per completion. No effect on money.
            </p>
          </div>
          </>
          )}

          {/* Has Subtasks Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="space-y-0.5">
              <Label htmlFor="edit-subtasks-mode" className="text-sm font-semibold flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                Has Subtasks
              </Label>
              <p className="text-xs text-muted-foreground">Task completes only when all subtasks are done</p>
            </div>
            <Switch
              id="edit-subtasks-mode"
              checked={hasSubtasks}
              onCheckedChange={setHasSubtasks}
            />
          </div>

          {/* Subtasks Input */}
          {hasSubtasks && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Subtasks (time is required)</Label>
              {!isHourly && amount && subtaskItems.length > 0 && (
                <p className="text-[11px] text-primary">
                  Split: ₹{(parseFloat(amount) / subtaskItems.length).toFixed(2)} per subtask
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  value={newSubtaskName}
                  onChange={(e) => setNewSubtaskName(e.target.value)}
                  placeholder="Subtask name…"
                  className="h-10 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                />
                <Input
                  type="time"
                  value={newSubtaskTime}
                  onChange={(e) => setNewSubtaskTime(e.target.value)}
                  className="h-10 w-32"
                  required
                />
                <Button
                  type="button"
                  onClick={addSubtask}
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10"
                  disabled={!newSubtaskName.trim() || !newSubtaskTime}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {subtaskItems.length > 0 && (
                <div className="space-y-2">
                  {subtaskItems
                    .map((subtask, originalIndex) => ({ subtask, originalIndex }))
                    .sort((a, b) => a.subtask.scheduledTime.localeCompare(b.subtask.scheduledTime))
                    .map(({ subtask, originalIndex }) => (
                      <div key={subtask.id ?? `new-${originalIndex}`} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold tabular-nums text-primary shrink-0">
                            {subtask.scheduledTime}
                          </span>
                          <span className="text-sm truncate">{subtask.name}</span>
                          {subtask.id && (
                            <span className="text-[10px] text-muted-foreground shrink-0">saved</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => removeSubtask(originalIndex)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
              {subtaskItems.length === 0 && (
                <p className="text-xs text-muted-foreground">Add at least one subtask (name + time)</p>
              )}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            className="w-full"
            size="lg"
            disabled={!name.trim() || (isHourly ? !perMinuteRate : !amount) || (hasSubtasks && subtaskItems.length === 0)}
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
