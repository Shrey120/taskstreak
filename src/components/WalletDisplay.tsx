import { useTasks } from '@/contexts/TaskContext';
import { Wallet, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WithdrawDialog } from './WithdrawDialog';

/**
 * Balance card for the nav rail / drawer.
 *
 * Laid out as a stack rather than a single row: the previous single-row version
 * put the label, the amount and the Withdraw button side by side, which left
 * the amount about 20px wide inside the 264px desktop sidebar and rendered as
 * a bare truncated "₹…".
 */
export function WalletDisplay() {
  const { wallet } = useTasks();
  const negative = wallet < 0;

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-3 shadow-card backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-gold shadow-gold">
          <Wallet className="h-4 w-4 text-accent-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Wallet
          </div>
          <div className="flex items-center gap-1">
            <span
              className={cn(
                'truncate font-display text-lg font-bold tabular-nums',
                negative ? 'text-destructive' : 'text-foreground',
              )}
              title={`₹${wallet.toFixed(2)}`}
            >
              ₹{wallet.toFixed(2)}
            </span>
            {wallet > 0 && <TrendingUp className="h-3.5 w-3.5 shrink-0 text-success" />}
            {negative && <TrendingDown className="h-3.5 w-3.5 shrink-0 text-destructive" />}
          </div>
        </div>
      </div>

      {negative && (
        <p className="mt-2 text-[11px] leading-snug text-destructive/90">
          You're in the red — complete tasks to climb back out.
        </p>
      )}

      <div className="mt-2.5">
        <WithdrawDialog />
      </div>
    </div>
  );
}
