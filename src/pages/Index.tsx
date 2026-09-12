import { useEffect, useState } from 'react';
import { TaskProvider } from '@/contexts/TaskContext';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { PauseManager } from '@/components/PauseManager';

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
import { AppSidebar, SIDEBAR_W, SIDEBAR_W_COLLAPSED } from '@/components/AppSidebar';
import { BottomNav } from '@/components/BottomNav';

import { labelForView, type ViewType } from '@/lib/navItems';
import { Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

/**
 * Views that lay out as a wide grid on desktop (cards, stat tiles) get the full
 * content width. The timeline is a single vertical list, so it keeps a reading
 * column instead of stretching a phone layout across a 27" display.
 */
const WIDE_VIEWS = new Set<string>(['all', 'growth', 'stack']);

const NAV_COLLAPSED_KEY = 'taskstreak:navCollapsed';

function Dashboard() {
  const [view, setView] = useState<ViewType>('timeline');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  // Defaults to the narrow icon rail so the sidebar costs 64px, not 260px.
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem(NAV_COLLAPSED_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const { triggerCompletion, particles, showBanner, earnedAmount } = useCompletionEffect();

  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, String(navCollapsed));
    } catch {
      /* private mode — the rail just won't be remembered */
    }
  }, [navCollapsed]);

  const isMetric = view.startsWith('metric:');
  const metric = isMetric ? (view.split(':')[1] as HabitMetric) : null;
  const wide = WIDE_VIEWS.has(view) || isMetric;
  const railWidth = navCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* One quiet ambient gradient instead of three stacked blobs */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Phones/tablets: drawer. Desktop: permanent rail. Only one is ever rendered. */}
      <div className="lg:hidden">
        <AppNavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} view={view} onSelect={setView} />
      </div>
      <AppSidebar
        view={view}
        onSelect={setView}
        collapsed={navCollapsed}
        onToggleCollapsed={() => setNavCollapsed((c) => !c)}
      />

      {/* The offset only applies from lg up, so it rides on a CSS variable
          rather than an inline padding that would also indent phones. */}
      <div
        className="transition-[padding] duration-200 lg:pl-[var(--rail-w)]"
        style={{ '--rail-w': `${railWidth}px` } as React.CSSProperties}
      >
        {/* App bar */}
        <header className="safe-top sticky top-0 z-30 border-b border-border/50 bg-background/70 backdrop-blur-xl">
          <div
            className={cn(
              'px-gutter mx-auto flex h-14 items-center gap-1 lg:h-16 lg:gap-4',
              wide ? 'max-w-[1440px]' : 'max-w-4xl',
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2.5 h-11 w-11 shrink-0 touch-manipulation lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-6 w-6" />
            </Button>

            <h1 className="min-w-0 flex-1 truncate pl-1 font-display text-lg font-bold text-foreground lg:pl-0 lg:text-xl">
              {labelForView(view)}
            </h1>

            {/* Timeline date controls live in the bar on desktop, where there's room */}
            {view === 'timeline' && (
              <div className="hidden items-center gap-2 lg:flex">
                <DateControls selectedDate={selectedDate} onChange={setSelectedDate} />
              </div>
            )}

            <div className="shrink-0 lg:ml-1">
              <DailyProgressRing size={34} strokeWidth={3.5} />
            </div>
          </div>
        </header>

        <main
          className={cn(
            'px-gutter relative z-10 mx-auto pt-4 lg:pt-7',
            // Room for the bottom bar + FAB on phones; neither exists on desktop.
            'pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-16',
            wide ? 'max-w-[1440px]' : 'max-w-4xl',
          )}
        >
          {view === 'timeline' && (
            <div className="mb-5 flex items-center gap-2 lg:hidden">
              <DateControls selectedDate={selectedDate} onChange={setSelectedDate} />
            </div>
          )}

          {view === 'all' && (
            <div className="mb-5 flex items-center justify-end">
              <PauseManager />
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
      </div>

      {/* Create task — floating action button, phones only (desktop has the
          sidebar's "New task" button, which doesn't cover any content). */}
      <CreateTaskDialog
        trigger={
          <Button
            size="icon"
            aria-label="Create task"
            className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-5 z-40 h-14 w-14 rounded-2xl shadow-glow touch-manipulation lg:hidden"
          >
            <Plus className="h-6 w-6" />
          </Button>
        }
      />

      <BottomNav view={view} onSelect={setView} />
    </div>
  );
}

function DateControls({
  selectedDate,
  onChange,
}: {
  selectedDate: Date;
  onChange: (d: Date) => void;
}) {
  const valid = !isNaN(selectedDate.getTime());
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isToday = valid && format(selectedDate, 'yyyy-MM-dd') === todayStr;

  return (
    <>
      <button
        onClick={() => onChange(new Date())}
        disabled={isToday}
        className={cn(
          'h-10 shrink-0 rounded-lg border px-3.5 text-[13px] font-semibold transition-colors touch-manipulation',
          isToday
            ? 'cursor-default border-border/50 bg-secondary/40 text-muted-foreground'
            : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 active:bg-primary/20',
        )}
      >
        Today
      </button>
      <input
        type="date"
        value={valid ? format(selectedDate, 'yyyy-MM-dd') : todayStr}
        max={todayStr}
        onChange={(e) => {
          if (!e.target.value) return;
          const [y, m, d] = e.target.value.split('-').map(Number);
          const dt = new Date(y, (m || 1) - 1, d || 1);
          if (!isNaN(dt.getTime())) onChange(dt);
        }}
        className="h-10 min-w-0 flex-1 rounded-lg border border-border/50 bg-card/50 px-3 text-[13px] text-foreground transition-colors focus:border-primary/50 focus:outline-none sm:max-w-[200px] sm:flex-none"
      />
    </>
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
