import { useState } from 'react';
import { TaskProvider } from '@/contexts/TaskContext';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';

import { AllTasksView } from '@/components/AllTasksView';
import { HabitMetricView, HabitMetric } from '@/components/HabitMetricView';
import { TimelineView } from '@/components/TimelineView';
import { StackView } from '@/components/StackView';
import { GrowthView } from '@/components/GrowthView';
import { CodexView } from '@/components/CodexView';
import { DailyProgressRing } from '@/components/DailyProgressRing';
import { CompletionEffectLayer, useCompletionEffect } from '@/components/CompletionEffect';
import { ReminderScheduler } from '@/components/ReminderScheduler';
import { AppNavDrawer } from '@/components/AppNavDrawer';
import { BottomNav } from '@/components/BottomNav';

import { CORE_TABS, labelForView, type ViewType } from '@/lib/navItems';
import { Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

function Dashboard() {
  const [view, setView] = useState<ViewType>('timeline');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { triggerCompletion, particles, showBanner, earnedAmount } = useCompletionEffect();

  const isMetric = view.startsWith('metric:');
  const metric = isMetric ? (view.split(':')[1] as HabitMetric) : null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* One quiet ambient gradient instead of three stacked blobs */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <AppNavDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        view={view}
        onSelect={setView}
      />

      {/* App bar */}
      <header className="safe-top sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="px-gutter mx-auto flex h-14 max-w-6xl items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2.5 h-11 w-11 shrink-0 touch-manipulation"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </Button>

          <h1 className="min-w-0 flex-1 truncate pl-1 font-display text-lg font-bold text-foreground">
            {labelForView(view)}
          </h1>

          <div className="shrink-0">
            <DailyProgressRing size={34} strokeWidth={3.5} />
          </div>
        </div>
      </header>

      <main className="px-gutter relative z-10 mx-auto max-w-6xl pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:pb-8">
        {/* Core destinations stay visible on desktop; phones use the bottom bar */}
        <div className="mb-5 hidden sm:block">
          <div className="inline-flex items-center gap-1 rounded-xl border border-border/50 bg-secondary/40 p-1">
            {CORE_TABS.map((t) => {
              const Icon = t.icon;
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline-only date controls */}
        {view === 'timeline' && (
          <div className="mb-5 flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(new Date())}
              className="h-10 shrink-0 rounded-lg border border-primary/20 bg-primary/10 px-3.5 text-[13px] font-semibold text-primary transition-colors touch-manipulation active:bg-primary/20"
            >
              Today
            </button>
            <input
              type="date"
              value={
                !isNaN(selectedDate.getTime())
                  ? format(selectedDate, 'yyyy-MM-dd')
                  : format(new Date(), 'yyyy-MM-dd')
              }
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => {
                if (!e.target.value) return;
                const [y, m, d] = e.target.value.split('-').map(Number);
                const dt = new Date(y, (m || 1) - 1, d || 1);
                if (!isNaN(dt.getTime())) setSelectedDate(dt);
              }}
              className="h-10 min-w-0 flex-1 rounded-lg border border-border/50 bg-card/50 px-3 text-[13px] text-foreground transition-colors focus:border-primary/50 focus:outline-none sm:max-w-[200px] sm:flex-none"
            />
          </div>
        )}

        <div className="animate-fade-in">
          {view === 'timeline' && (
            <TimelineView selectedDate={selectedDate} onTaskComplete={triggerCompletion} />
          )}
          {view === 'stack' && <StackView />}
          {view === 'all' && <AllTasksView />}
          {view === 'growth' && <GrowthView />}
          {view === 'codex' && <CodexView />}
          {isMetric && metric && <HabitMetricView metric={metric} />}
        </div>

        <CompletionEffectLayer
          particles={particles}
          showBanner={showBanner}
          earnedAmount={earnedAmount}
        />
      </main>

      {/* Create task — floating action button */}
      <CreateTaskDialog
        trigger={
          <Button
            size="icon"
            aria-label="Create task"
            className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-5 z-40 h-14 w-14 rounded-2xl shadow-glow touch-manipulation sm:bottom-6 sm:right-6"
          >
            <Plus className="h-6 w-6" />
          </Button>
        }
      />

      <BottomNav view={view} onSelect={setView} />
    </div>
  );
}

export default function Index() {
  return (
    <TaskProvider>
      <ReminderScheduler />
      <Dashboard />
    </TaskProvider>
  );
}