// Task-reminder scheduler backed by Capacitor Local Notifications on native,
// and the browser Notification API on the web (best-effort fallback).
//
// Fires REMINDER_LEAD_MIN minutes before every task's scheduledTime for today
// and tomorrow. Reschedules whenever tasks change.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isTaskDueOnDateGeneric } from './streakUtils';
import type { Task } from '@/types/task';

export const REMINDER_LEAD_MIN = 5;

const isNative = () => Capacitor.isNativePlatform();

// Stable numeric id for (taskId, dateKey).
function idFor(taskId: string, dateKey: string): number {
  let h = 5381;
  const s = `${taskId}|${dateKey}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

function parseHHmm(t: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Fire {
  id: number;
  title: string;
  body: string;
  fireAt: Date;
}

function buildFires(tasks: Task[], now: Date): Fire[] {
  const out: Fire[] = [];
  const days = [new Date(now), new Date(now.getTime() + 24 * 3600_000)];
  for (const day of days) {
    const key = dateKey(day);
    for (const task of tasks) {
      if (!task.scheduledTime) continue;
      const hm = parseHHmm(task.scheduledTime);
      if (!hm) continue;
      if (!isTaskDueOnDateGeneric(task, day)) continue;

      const taskAt = new Date(day);
      taskAt.setHours(hm.h, hm.m, 0, 0);
      const fireAt = new Date(taskAt.getTime() - REMINDER_LEAD_MIN * 60_000);
      if (fireAt.getTime() <= now.getTime() + 30_000) continue; // skip if past or too soon

      out.push({
        id: idFor(task.id, key),
        title: `⏰ ${task.name}`,
        body: `Starts in ${REMINDER_LEAD_MIN} minutes`,
        fireAt,
      });
    }
  }
  return out;
}

// ------- Native path -------

let permissionRequested = false;

async function ensureNativePermission(): Promise<boolean> {
  const status = await LocalNotifications.checkPermissions();
  if (status.display === 'granted') return true;
  if (permissionRequested) return false;
  permissionRequested = true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === 'granted';
}

async function scheduleNative(fires: Fire[]) {
  const ok = await ensureNativePermission();
  if (!ok) return;

  // Clear only our previously-scheduled reminders.
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }
  } catch (e) {
    console.warn('[notif] cancel pending failed', e);
  }

  if (!fires.length) return;

  await LocalNotifications.schedule({
    notifications: fires.map((f) => ({
      id: f.id,
      title: f.title,
      body: f.body,
      schedule: { at: f.fireAt, allowWhileIdle: true },
      sound: 'chime.wav', // drop chime.wav in android/app/src/main/res/raw and ios/App/App/
      smallIcon: 'ic_stat_icon_config_sample',
      channelId: 'task-reminders',
    })),
  });
}

// ------- Web fallback -------
// Real Web Push (works even when the app is closed) is handled by the
// Supabase edge function `send-task-reminders` + the service worker at
// public/sw.js. See src/lib/webPush.ts for enrollment. The old in-tab
// setTimeout fallback was unreliable (only fired while the tab was open)
// and has been removed.

async function scheduleWeb(_fires: Fire[]) {
  /* no-op — server-side Web Push handles web reminders */
}


// ------- Public API -------

export async function initReminders() {
  if (isNative()) {
    try {
      await LocalNotifications.createChannel({
        id: 'task-reminders',
        name: 'Task reminders',
        description: 'Fires before every scheduled task',
        importance: 5,
        sound: 'chime.wav',
        vibration: true,
      });
    } catch (e) {
      // channel API is Android-only; iOS will throw — safe to ignore
    }
    await ensureNativePermission();
  }
  // Web push is enrolled via src/lib/webPush.ts and delivered by the
  // Supabase edge function `send-task-reminders`. Nothing to do here.
}

export async function rescheduleReminders(tasks: Task[]) {
  const fires = buildFires(tasks, new Date());
  if (isNative()) {
    await scheduleNative(fires).catch((e) => console.warn('[notif] native schedule failed', e));
  } else {
    await scheduleWeb(fires);
  }
}
