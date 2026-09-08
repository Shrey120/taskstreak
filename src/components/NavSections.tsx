import { CORE_TABS, METRIC_TABS, type ViewType } from '@/lib/navItems';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function SectionLabel({
  children,
  collapsed = false,
}: {
  children: React.ReactNode;
  collapsed?: boolean;
}) {
  // Collapsed rail has no room for a word, so the group reads as a rule instead.
  if (collapsed) return <div className="mx-3 my-2 h-px bg-border/60" />;
  return (
    <p className="px-4 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/80">
      {children}
    </p>
  );
}

export function NavRow({
  label,
  icon: Icon,
  active,
  collapsed = false,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'flex items-center rounded-xl text-left text-[13px] font-medium',
        'min-h-[44px] touch-manipulation transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        collapsed ? 'w-11 justify-center px-0' : 'w-full gap-3 px-4 py-3',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground active:bg-secondary/70',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  if (!collapsed) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** The Views + Habit metrics lists, shared by the mobile drawer and the desktop rail. */
export function NavSections({
  view,
  onSelect,
  collapsed = false,
}: {
  view: ViewType;
  onSelect: (view: ViewType) => void;
  collapsed?: boolean;
}) {
  return (
    <>
      <SectionLabel collapsed={collapsed}>Views</SectionLabel>
      <nav className={cn('space-y-1', collapsed ? 'flex flex-col items-center px-0' : 'px-2')}>
        {CORE_TABS.map((t) => (
          <NavRow
            key={t.id}
            label={t.label}
            icon={t.icon}
            active={view === t.id}
            collapsed={collapsed}
            onClick={() => onSelect(t.id)}
          />
        ))}
      </nav>

      <SectionLabel collapsed={collapsed}>Habit metrics</SectionLabel>
      <nav className={cn('space-y-1', collapsed ? 'flex flex-col items-center px-0' : 'px-2')}>
        {METRIC_TABS.map((t) => {
          const id = `metric:${t.id}` as ViewType;
          return (
            <NavRow
              key={t.id}
              label={t.label}
              icon={t.icon}
              active={view === id}
              collapsed={collapsed}
              onClick={() => onSelect(id)}
            />
          );
        })}
      </nav>
    </>
  );
}
