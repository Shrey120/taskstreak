import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useTasks } from '@/contexts/TaskContext';
import { Task, FrequencyType, DayOfWeek, DAYS_OF_WEEK, DIFFICULTY_MULTIPLIERS, Subtask } from '@/types/task';
import { TRAITS, TraitId } from '@/lib/xpUtils';
import { Plus, HelpCircle, CalendarIcon, Clock, X, ListChecks } from 'lucide-react';
import { TimePicker } from './TimePicker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DayPresetChips } from './DayPresetChips';
import { WeeklyLoadPreview } from './WeeklyLoadPreview';
import { toKey, weekStartKey } from '@/lib/periodUtils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CreateTaskDialogProps {
  trigger?: ReactNode;
}

export function CreateTaskDialog({ trigger }: CreateTaskDialogProps) {
  const { addTask } = useTasks();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('weekly');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedMonthDays, setSelectedMonthDays] = useState<number[]>([]);
  const [specificDate, setSpecificDate] = useState<Date>();
  const [weekInterval, setWeekInterval] = useState('2');
  const [specificDay, setSpecificDay] = useState<DayOfWeek>('monday');
  const [minDaysWeek, setMinDaysWeek] = useState('3');
  const [minDaysMonth, setMinDaysMonth] = useState('10');
  const [amount, setAmount] = useState('');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [isHourly, setIsHourly] = useState(false);
  const [perMinuteRate, setPerMinuteRate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [hasSubtasks, setHasSubtasks] = useState(false);
  const [traits, setTraits] = useState<TraitId[]>(['discipline']);
  const [subtaskItems, setSubtaskItems] = useState<{ name: string; scheduledTime: string }[]>([]);
  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [newSubtaskTime, setNewSubtaskTime] = useState('');

  const resetForm = () => {
    setName('');
    setFrequencyType('weekly');
    setSelectedDays([]);
    setSelectedMonthDays([]);
    setSpecificDate(undefined);
    setSpecificDay('monday');
    setMinDaysWeek('3');
    setMinDaysMonth('10');
    setAmount('');
    setDifficulty(1);
    setStartDate(new Date());
    setIsHourly(false);
    setPerMinuteRate('');
    setScheduledTime('');
    setHasSubtasks(false);
    setTraits(['discipline']);
    setSubtaskItems([]);
    setNewSubtaskName('');
    setNewSubtaskTime('');
  };

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

  const handleSubmit = () => {
    if (!name.trim() || (isHourly ? !perMinuteRate : !amount)) return;

    let frequencyValue: Task['frequencyValue'];
    switch (frequencyType) {
      case 'weekly':
        frequencyValue = selectedDays;
        break;
      case 'monthly':
        frequencyValue = selectedMonthDays;
        break;
      case 'specific-date':
        frequencyValue = specificDate ? format(specificDate, 'yyyy-MM-dd') : '';
        break;
      case 'every-n-weeks':
        frequencyValue = {
          interval: Math.max(1, parseInt(weekInterval, 10) || 2),
          days: selectedDays,
          // Anchor on the current week, so "every other week" starts now.
          anchor: weekStartKey(toKey(new Date())),
        };
        break;
      case 'at-least-weekly':
        frequencyValue = parseInt(minDaysWeek) || 3;
        break;
      case 'at-least-monthly':
        frequencyValue = parseInt(minDaysMonth) || 10;
        break;
    }

    const subtasks: Subtask[] = hasSubtasks
      ? subtaskItems.map((s) => ({
          id: '',
          taskId: '',
          name: s.name,
          isCompleted: false,
          scheduledTime: s.scheduledTime,
        }))
      : [];

    addTask({
      name: name.trim(),
      frequencyType,
      frequencyValue,
      amount: isHourly ? 0 : parseFloat(amount),
      baseAmount: isHourly ? 0 : parseFloat(amount),
      difficulty: isHourly ? 1 : difficulty,
      startDate: format(startDate, 'yyyy-MM-dd'),
      scheduledTime: scheduledTime || null,
      isHourly,
      perMinuteRate: isHourly ? parseFloat(perMinuteRate) : 0,
      subtasks,
      traits: traits.length > 0 ? traits : ['discipline'],
    });


    resetForm();
    setOpen(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
              {trigger ?? (
                <Button size="lg" className="gap-2 h-10 sm:h-11 px-3 sm:px-6">
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Create Task</span>
                  <span className="sm:hidden">New</span>
                </Button>
              )}
            </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Create New Task</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5 py-4">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold">Task Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Exercise"
              className="h-11"
            />
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-11')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">Task will only appear from this date onwards</p>
          </div>

          {/* Scheduled Time (optional) */}
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
            <p className="text-xs text-muted-foreground">Set a time to see this task in the timeline view</p>
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

          {/* Frequency Value */}
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
                <WeeklyLoadPreview selectedDays={selectedDays} />
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
              <p className="text-xs text-muted-foreground">Task will appear every day; complete it at least {minDaysWeek} times per week</p>
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
              <p className="text-xs text-muted-foreground">Task will appear every day; complete it at least {minDaysMonth} times per month</p>
            </div>
          )}

          {frequencyType === 'specific-date' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Select Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-11', !specificDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {specificDate ? format(specificDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={specificDate}
                    onSelect={setSpecificDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
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
              <p className="text-xs text-muted-foreground">
                Counting from this week, then skipping {Math.max(1, parseInt(weekInterval, 10) || 2) - 1}.
              </p>
            </div>
          )}

          {/* Hourly Task Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="space-y-0.5">
              <Label htmlFor="hourly-mode" className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Hourly Task
              </Label>
              <p className="text-xs text-muted-foreground">Pay based on time worked (per minute)</p>
            </div>
            <Switch
              id="hourly-mode"
              checked={isHourly}
              onCheckedChange={setIsHourly}
            />
          </div>

          {isHourly ? (
            /* Per Minute Rate for Hourly Tasks */
            <div className="space-y-2">
              <Label htmlFor="perMinuteRate" className="text-sm font-semibold">Rate per Minute (₹)</Label>
              <Input
                id="perMinuteRate"
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
            <>
              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-semibold">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., 50"
                  className="h-11"
                  min="0"
                  step="0.01"
                />
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
                      <p className="mt-2 text-xs text-muted-foreground">
                        Complete 7 days in a row to permanently multiply the task amount!
                      </p>
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
            </>
          )}

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
            <p className="text-xs text-muted-foreground">
              Completing this task grants full XP to every selected trait.
            </p>
          </div>




          {/* Subtasks Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="space-y-0.5">
              <Label htmlFor="subtasks-mode" className="text-sm font-semibold flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                Has Subtasks
              </Label>
              <p className="text-xs text-muted-foreground">Task completes only when all subtasks are done</p>
            </div>
            <Switch
              id="subtasks-mode"
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
                    .slice()
                    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
                    .map((subtask, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold tabular-nums text-primary shrink-0">
                            {subtask.scheduledTime}
                          </span>
                          <span className="text-sm truncate">{subtask.name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => removeSubtask(subtaskItems.indexOf(subtask))}
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
            Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
