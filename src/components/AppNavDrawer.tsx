import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { WalletDisplay } from '@/components/WalletDisplay';
import { XpDisplay } from '@/components/XpDisplay';
import { NavSections } from '@/components/NavSections';
import { type ViewType } from '@/lib/navItems';
import { LogOut, Sparkles } from 'lucide-react';

interface AppNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ViewType;
  onSelect: (view: ViewType) => void;
}

/**
 * Navigation for phones and tablets only. On lg+ the same destinations live in
 * the always-visible AppSidebar, and this drawer is never mounted.
 */
export function AppNavDrawer({ open, onOpenChange, view, onSelect }: AppNavDrawerProps) {
  const { user, logout } = useAuth();

  const pick = (v: ViewType) => {
    onSelect(v);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[300px] flex-col gap-0 p-0 sm:w-[340px]">
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        {/* Brand + account */}
        <div className="border-b border-border/50 px-5 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))]">
          <div className="mb-4 flex items-center gap-1.5">
            <span className="font-display text-lg font-bold text-foreground">TaskStreak</span>
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full gradient-primary text-lg font-bold text-primary-foreground">
              {(user?.username ?? '?').charAt(0).toUpperCase()}
            </div>
            <span className="truncate text-[13px] font-medium text-foreground">@{user?.username}</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-2">
          <div className="space-y-3 px-4 pt-4">
            <WalletDisplay />
            <XpDisplay />
          </div>
          <NavSections view={view} onSelect={pick} />
        </div>

        {/* Pinned footer */}
        <div className="border-t border-border/50 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={logout}
            className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-muted-foreground transition-colors touch-manipulation active:bg-destructive/10 active:text-destructive"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Log out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
