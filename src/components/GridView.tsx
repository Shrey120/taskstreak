import { useTasks } from '@/contexts/TaskContext';
import { TaskCard } from './TaskCard';
import { format } from 'date-fns';
import { ClipboardList } from 'lucide-react';

interface GridViewProps {
  selectedDate: Date;
  onTaskComplete?: (amount: number, element?: HTMLElement) => void;
}

export function GridView({ selectedDate, onTaskComplete }: GridViewProps) {
  const { getTasksForDate } = useTasks();
  const tasks = getTasksForDate(selectedDate);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Tasks for {format(selectedDate, 'MMMM d, yyyy')}
        </h2>
        <span className="text-sm text-muted-foreground">
          {tasks.length} pending
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl bg-card/80 border border-dashed border-border/50 backdrop-blur-sm">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
            <ClipboardList className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-display font-medium text-foreground mb-1">All caught up!</p>
          <p className="text-sm text-muted-foreground text-center">
            No tasks scheduled for this day, or you've completed them all.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} date={selectedDate} onComplete={onTaskComplete} />
          ))}
        </div>
      )}
    </div>
  );
}
