import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { enablePush, disablePush, isPushEnabled, pushSupport } from '@/lib/push';
import { toast } from 'sonner';

const REASON_MESSAGE: Record<string, string> = {
  unsupported: "This browser can't do push notifications.",
  'ios-needs-install': 'On iPhone, add TaskStreak to your Home Screen first — Safari only allows notifications from an installed app.',
  'no-vapid-key': 'Notifications are not configured yet (missing VAPID key).',
  denied: 'Notifications are blocked. Allow them for this site in your browser settings.',
};

export function NotificationToggle() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const deviceId = user?.device_id || '';
  const support = pushSupport();

  useEffect(() => {
    isPushEnabled().then(setEnabled);
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast('Notifications off for this device.');
      } else {
        const result = await enablePush(deviceId);
        if (result.ok) {
          setEnabled(true);
          toast.success('Notifications on. Reminders will arrive on this device.');
        } else {
          toast.error(REASON_MESSAGE[result.reason ?? ''] ?? 'Could not turn notifications on.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  // Each device subscribes separately, so this is per-device, not per-account.
  const blocked = !support.ok && !enabled;

  return (
    <Button
      variant="outline"
      className="gap-2"
      onClick={toggle}
      disabled={busy || !deviceId || blocked}
      title={support.ok ? undefined : REASON_MESSAGE[support.reason ?? '']}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : enabled ? (
        <Bell className="w-4 h-4" />
      ) : (
        <BellOff className="w-4 h-4" />
      )}
      {enabled ? 'Notifications on' : 'Notifications off'}
    </Button>
  );
}
