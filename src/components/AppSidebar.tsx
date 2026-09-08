import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TaskContext';
import { WalletDisplay } from '@/components/WalletDisplay';
import { XpDisplay } from '@/components/XpDisplay';
import { NavSections } from '@/components/NavSections';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TRAITS, levelForXp } from '@/lib/xpUtils';
import { type ViewType } from '@/lib/navItems';
import { cn } from '@/lib/utils';
import { Flame, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Sparkles, Wallet } from 'lucide-react';

/** Rail widths. Kept here and mirrored by Index's content offset. */
export const SIDEBAR_W = 260;
export const SIDEBAR_W_COLLAPSED = 64;

interface AppSidebarProps {
  view: ViewType;
  onSelect: (view: ViewType) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * Permanent desktop navigation (lg and up). Replaces the phone shell entirely:
 * where a phone gets a hamburger drawer, a bottom tab bar and a floating action
 * button, a laptop gets this rail with every destination already on screen.
 *
 * Collapses to a 64px icon rail so it costs almost no horizontal space; the
 * choice is remembered across sessions.
 */
export function AppSidebar({ view, onSelect, collapsed, onToggleCollapsed }: AppSidebarProps) {
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border/50 bg-sidebar lg:flex',
        'transition-[width] duration-200',
      )}
      style={{ width: collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W }}
    >
      {/* Brand + collapse toggle */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-border/50',
          collapsed ? 'justify-center px-0' : 'gap-1.5 px-4',
        )}
      >
        {!collapsed && (
          <>
            <span className="font-display text-lg font-bold text-foreground">TaskStreak</span>
            <Sparkles className="h-4 w-4 text-accent" />
          </>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn('h-9 w-9 shrink-0 text-muted-foreground', !collapsed && 'ml-auto -mr-1')}
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
        </Tooltip>
      </div>

      <div
        className={cn(
          'flex-1 overflow-y-auto overscroll-contain pb-4',
          collapsed && 'scrollbar-hide',
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 pt-3">
            <CreateTaskDialog
              trigger={
                <Button size="icon" aria-label="New task" className="h-11 w-11 shrink-0">
                  <Plus className="h-5 w-5" />
                </Button>
              }
            />
            <CollapsedStats />
          </div>
        ) : (
          <div className="space-y-3 px-3 pt-3">
            <CreateTaskDialog
              trigger={
                <Button className="h-11 w-full justify-start gap-2 font-semibold">
                  <Plus className="h-4 w-4" />
                  New task
                </Button>
              }
            />
            <WalletDisplay />
            <XpDisplay />
          </div>
        )}

        <NavSections view={view} onSelect={onSelect} collapsed={collapsed} />
      </div>

      {/* Account footer */}
      <div className={cn('shrink-0 border-t border-border/50', collapsed ? 'p-2' : 'p-3')}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={logout}
                aria-label={`Log out @${user?.username ?? ''}`}
                className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Log out @{user?.username}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full gradient-primary text-sm font-bold text-primary-foreground">
              {(user?.username ?? '?').charAt(0).toUpperCase()}
            </div>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              @{user?.username}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}

/** Wallet + level reduced to two tooltipped glyphs for the 64px rail. */
function CollapsedStats() {
  const { wallet, traitXp } = useTasks();
  const totalXp = TRAITS.reduce((s, t) => s + (traitXp[t.id] || 0), 0);
  const level = levelForXp(totalXp).level;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mt-1 flex h-11 w-11 cursor-default flex-col items-center justify-center rounded-xl border border-border/50 bg-card/80">
            <Wallet className="h-4 w-4 text-accent" />
            <span
              className={cn(
                'mt-0.5 text-[9px] font-bold tabular-nums',
                wallet < 0 ? 'text-destructive' : 'text-foreground',
              )}
            >
              {compactMoney(wallet)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Wallet · ₹{wallet.toFixed(2)}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-11 w-11 cursor-default flex-col items-center justify-center rounded-xl border border-border/50 bg-card/80">
            <Flame className={cn('h-4 w-4', level < 0 ? 'text-destructive' : 'text-primary')} />
            <span
              className={cn(
                'mt-0.5 text-[9px] font-bold tabular-nums',
                level < 0 ? 'text-destructive' : 'text-foreground',
              )}
            >
              {level}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          Level {level} · {totalXp.toLocaleString()} XP
        </TooltipContent>
      </Tooltip>
    </>
  );
}

function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100_000) return `${sign}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${Math.round(abs)}`;
}
