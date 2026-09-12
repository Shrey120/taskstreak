import { BOTTOM_NAV, type ViewType } from '@/lib/navItems';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  view: ViewType;
  onSelect: (view: ViewType) => void;
}

export function BottomNav({ view, onSelect }: BottomNavProps) {
  return (
    <nav
      className={cn(
        // Hidden from lg up, where AppTopNav carries every destination instead.
      'fixed inset-x-0 bottom-0 z-40 lg:hidden',
        'safe-bottom safe-x border-t border-border/50 bg-background/90 backdrop-blur-xl',
      )}
    >
      <div className="flex items-stretch justify-around">
        {BOTTOM_NAV.map((t) => {
          const Icon = t.icon;
          const active = view === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2.5',
                'min-h-[56px] touch-manipulation transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground active:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  active && 'bg-primary/15',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-medium leading-none">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
