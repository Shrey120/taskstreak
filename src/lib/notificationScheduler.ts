// Task-reminder scheduler backed by Capacitor Local Notifications on native,
// and the browser Notification API on the web (best-effort fallback).
//
// Fires REMINDER_LEAD_MIN minutes before every task's scheduledTime for today
// and tomorrow. Reschedules whenever tasks change.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isTaskDueOnDateGeneric, getStreakCycleLength } from './streakUtils';
import { isPausedOn, type PauseRange } from './schedule';
import { DIFFICULTY_MULTIPLIERS, type Task } from '@/types/task';

export const REMINDER_LEAD_MIN = 5;

/** Local hour the evening alerts fire at. Mirrors the edge function. */
const EVENING_HOUR = 20;
/** Warn once a task is this close to closing its cycle. */
const RISK_AT = 5;

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Extra device state the alerts need; both are streak-neutral exclusions. */
export interface ReminderContext {
  pauseRanges: PauseRange[];
  dayOffSet: Set<string>;
}

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
  channelId: 'task-reminders' | 'streak-alerts';
  /** Android keeps these up until dismissed — used for streak risk only. */
  sticky?: boolean;
}

function buildFires(tasks: Task[], now: Date, ctx: ReminderContext): Fire[] {
  const out: Fire[] = [];
  const days = [new Date(now), new Date(now.getTime() + 24 * 3600_000)];
  for (const day of days) {
    const key = dateKey(day);
    // Inside a vacation window nothing is due, so nothing should nag.
    if (isPausedOn(ctx.pauseRanges, key)) continue;
    for (const task of tasks) {
      if (!task.scheduledTime) continue;
      const hm = parseHHmm(task.scheduledTime);
      if (!hm) continue;
      if (!isTaskDueOnDateGeneric(task, day)) continue;

      const taskAt = new Date(day);
      taskAt.setHours(hm.h, hm.m, 0, 0);
      const idealFireAt = new Date(taskAt.getTime() - REMINDER_LEAD_MIN * 60_000);
      // The task itself has already started (or starts in under 30s) —
      // nothing useful left to remind about.
      if (taskAt.getTime() <= now.getTime() + 30_000) continue;
      // The ideal lead time has already passed (task is due sooner than
      // REMINDER_LEAD_MIN away) but the task hasn't started yet: fire almost
      // immediately instead of silently dropping the reminder. This is the
      // case a task created with only a few minutes' notice hits every time.
      const fireAt = idealFireAt.getTime() > now.getTime() + 30_000
        ? idealFireAt
        : new Date(now.getTime() + 10_000);

      out.push({
        id: idFor(task.id, key),
        title: `⏰ ${task.name}`,
        body: `Starts in ${REMINDER_LEAD_MIN} minutes`,
        fireAt,
        channelId: 'task-reminders',
      });
    }
  }
  return out;
}

/**
 * Streak-risk and Sunday-digest alerts, scheduled on-device so the installed
 * APK gets them without any server involvement.
 *
 * Content is baked in at schedule time, which is the one real difference from
 * the server version: completing a task later would leave a stale alert queued.
 * `rescheduleReminders` cancels and rebuilds on every task change, and every
 * completion goes through the app, so in practice the stale window closes
 * immediately -- but that is why these are rebuilt rather than scheduled once.
 */
function buildEveningFires(tasks: Task[], now: Date, ctx: ReminderContext): Fire[] {
  const out: Fire[] = [];

  // TODAY ONLY, unlike the task-due reminders which safely queue two days
  // ahead. Their text is static; this text is derived from the current streak
  // and this week's completions, so a copy queued for tomorrow would announce
  // numbers that tonight's activity has already changed -- "6/7" is simply
  // wrong once the cycle closes. Tomorrow's is built when the app next opens,
  // which happens every day by definition: completing a task requires it.
  {
    const day = new Date(now);
    const key = dateKey(day);
    if (isPausedOn(ctx.pauseRanges, key)) return out;

    const fireAt = new Date(day);
    fireAt.setHours(EVENING_HOUR, 0, 0, 0);
    if (fireAt.getTime() <= now.getTime() + 30_000) return out;

    // --- streak at risk ---
    for (const task of tasks) {
      const cycle = getStreakCycleLength(task);
      if (!Number.isFinite(cycle)) continue; // one-off tasks have no cycle
      const streak = task.currentStreak ?? 0;
      if (streak < RISK_AT || streak >= cycle) continue;
      if (!isTaskDueOnDateGeneric(task, day)) continue;
      if (ctx.dayOffSet.has(`${task.id}|${key}`)) continue;
      if (task.completions.some((c) => c.date === key && c.earnedAmount > 0)) continue;

      const left = cycle - streak;
      const mult = DIFFICULTY_MULTIPLIERS[task.difficulty] ?? 1.5;
      const raise = task.isHourly
        ? 'a +₹0.50/min raise'
        : `a raise to ${money(task.amount * mult)}`;
      const stake = task.isHourly ? '' : ` Missing it costs ${money(task.amount)}.`;

      out.push({
        id: idFor(`risk|${task.id}`, key),
        title: `🔥 ${streak}/${cycle} — ${task.name}`,
        body: left === 1
          ? `Last one. Finish today to close the cycle and earn ${raise}.${stake}`
          : `${left} to go. Break it now and the streak resets to zero.${stake}`,
        fireAt,
        channelId: 'streak-alerts',
        sticky: true,
      });
    }

    // --- Sunday digest ---
    if (day.getDay() !== 0) return out;
    const weekStart = new Date(day.getTime() - 6 * 24 * 3600_000);
    const fromKey = dateKey(weekStart);
    let earned = 0;
    let done = 0;
    let failed = 0;
    for (const task of tasks) {
      for (const c of task.completions) {
        if (c.date < fromKey || c.date > key) continue;
        if (c.earnedAmount > 0) { earned += c.earnedAmount; done++; } else { failed++; }
      }
    }

    out.push({
      id: idFor('digest', key),
      title: '📜 Your week',
      body: done === 0 && failed === 0
        ? 'Nothing logged this week. A fresh week starts tomorrow.'
        : `${money(earned)} earned · ${done} done` + (failed ? ` · ${failed} missed` : '') +
          '. Open the Report for the full picture.',
      fireAt,
      channelId: 'streak-alerts',
    });
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
      // Both resource names below are placeholders that do not exist yet; the
      // Capacitor plugin falls back to Android's defaults when a named
      // resource is missing, so this is cosmetic rather than load-bearing.
      sound: 'chime.wav',
      smallIcon: 'ic_stat_icon_config_sample',
      channelId: f.channelId,
      ongoing: f.sticky === true,
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
      // Separate channel so streak warnings and the weekly digest can be
      // muted independently of routine task reminders in Android settings.
      await LocalNotifications.createChannel({
        id: 'streak-alerts',
        name: 'Streak alerts & weekly digest',
        description: 'Evening warning when a streak is about to break, and the Sunday summary',
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

export async function rescheduleReminders(tasks: Task[], ctx: ReminderContext) {
  const now = new Date();
  const fires = [...buildFires(tasks, now, ctx), ...buildEveningFires(tasks, now, ctx)];
  if (isNative()) {
    await scheduleNative(fires).catch((e) => console.warn('[notif] native schedule failed', e));
  } else {
    await scheduleWeb(fires);
  }
}
