import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTasks } from '@/contexts/TaskContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowDownLeft, History, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WithdrawHistoryItem {
  id: string;
  amount: number;
  created_at: string;
  reason: string | null;
}

export function WithdrawDialog() {
  const { wallet, withdrawFromWallet } = useTasks();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<WithdrawHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const deviceId = user?.device_id || '';

  const loadHistory = async () => {
    if (!deviceId) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('withdraw_history')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (open && deviceId) {
      loadHistory();
    }
  }, [open, deviceId]);

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    if (withdrawAmount > wallet) {
      toast({
        title: 'Not enough in the wallet',
        description: `You can withdraw up to ₹${wallet.toFixed(2)}.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    // Move the money first. Writing history before the balance changed left an
    // orphan ledger row behind whenever the wallet update failed.
    const success = await withdrawFromWallet(withdrawAmount);
    if (!success) {
      setSubmitting(false);
      toast({ title: 'Withdrawal failed', variant: 'destructive' });
      return;
    }

    if (deviceId) {
      const { error: historyError } = await supabase
        .from('withdraw_history')
        .insert({ device_id: deviceId, amount: withdrawAmount, reason: reason.trim() || null });
      if (historyError) {
        console.error('Error saving history:', historyError);
        toast({
          title: 'Withdrawal went through',
          description: "It couldn't be added to your history, though.",
        });
      }
    }

    toast({ title: `₹${withdrawAmount.toFixed(2)} withdrawn successfully!` });
    setAmount('');
    setReason('');
    setSubmitting(false);
    loadHistory();
  };

  const parsedAmount = parseFloat(amount);
  const amountIsValid = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= wallet;
  const overBalance = !isNaN(parsedAmount) && parsedAmount > wallet;

  const totalWithdrawn = history.reduce((sum, h) => sum + Number(h.amount), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-1.5" disabled={wallet <= 0}>
          <ArrowDownLeft className="w-4 h-4" />
          Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw from Wallet</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="withdraw" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="w-3.5 h-3.5" />
              History
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="withdraw" className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              Available balance: <span className="font-semibold text-foreground">₹{wallet.toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                max={wallet}
                step="0.01"
              />
              {overBalance && (
                <p className="text-xs text-destructive">
                  That's more than the ₹{wallet.toFixed(2)} available.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                type="text"
                placeholder="e.g., Groceries, Bills, Savings..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={100}
              />
            </div>
            <Button onClick={handleWithdraw} className="w-full" disabled={!amountIsValid || submitting}>
              {submitting ? 'Withdrawing…' : 'Withdraw'}
            </Button>
          </TabsContent>
          
          <TabsContent value="history" className="py-4">
            {loadingHistory ? (
              <div className="text-center py-6 text-muted-foreground">Loading...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p>No withdrawals yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                    <div className="text-xs text-muted-foreground">Total Withdrawn</div>
                    <div className="text-xl font-bold text-accent">₹{totalWithdrawn.toFixed(2)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-xs text-muted-foreground">Withdrawals</div>
                    <div className="text-xl font-bold text-primary">{history.length}</div>
                  </div>
                </div>
                
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div 
                        key={item.id} 
                        className="p-2.5 rounded-lg bg-secondary/50 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {format(parseISO(item.created_at), 'dd MMM yyyy, hh:mm a')}
                          </div>
                          <span className="font-semibold text-foreground">₹{Number(item.amount).toFixed(2)}</span>
                        </div>
                        {item.reason && (
                          <p className="text-xs text-muted-foreground pl-5.5">{item.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}