import { useTasks } from '@/contexts/TaskContext';
import { Wallet, TrendingUp } from 'lucide-react';
import { WithdrawDialog } from './WithdrawDialog';

export function WalletDisplay() {
  const { wallet } = useTasks();

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-xl bg-card/80 shadow-card border border-border/50 neon-border backdrop-blur-sm hover:shadow-glow transition-all duration-500 group min-w-0">
      <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg gradient-gold shadow-gold group-hover:animate-float shrink-0">
        <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-accent-foreground" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="hidden sm:inline text-xs font-semibold text-muted-foreground uppercase tracking-widest font-body">Wallet</span>
        <div className="flex items-center gap-1">
          <span className="text-base sm:text-xl font-bold text-foreground font-display tabular-nums truncate">₹{wallet.toFixed(2)}</span>
          {wallet > 0 && <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success shrink-0" />}
        </div>
      </div>
      <WithdrawDialog />
    </div>
  );
}
