import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';

interface MinutesInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  perMinuteRate: number;
  onConfirm: (minutes: number) => void;
}

export function MinutesInputDialog({ 
  open, 
  onOpenChange, 
  taskName, 
  perMinuteRate, 
  onConfirm 
}: MinutesInputDialogProps) {
  const [minutes, setMinutes] = useState('');

  const handleConfirm = () => {
    const mins = parseInt(minutes);
    if (mins > 0) {
      onConfirm(mins);
      setMinutes('');
      onOpenChange(false);
    }
  };

  const earnedAmount = minutes ? parseInt(minutes) * perMinuteRate : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Log Time for {taskName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="minutes">Minutes Worked</Label>
            <Input
              id="minutes"
              type="number"
              placeholder="Enter minutes..."
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              min="1"
              autoFocus
            />
          </div>
          
          <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rate per minute</span>
              <span className="font-medium">₹{perMinuteRate.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Minutes</span>
              <span className="font-medium">{minutes || 0}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="font-medium">Total Earnings</span>
              <span className="text-lg font-bold text-accent">₹{earnedAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!minutes || parseInt(minutes) <= 0}>
            Complete Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
