// Sends Web Push reminders 5 minutes before each due task's scheduled time.
// Invoked every minute by pg_cron. Idempotent via public.sent_reminders.
// Timezone-aware: each push_subscription stores tz_offset_minutes (minutes
// east of UTC, e.g. IST = 330). Task scheduled_time is a wall-clock "HH:MM"
// in the device's LOCAL timezone, so we shift accordingly when computing
// due-date, target instant, and reminder_date.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const REMINDER_LEAD_MIN = 5;
// A single fixed-width slice at exactly now+LEAD..now+LEAD+1 missed any task
// due SOONER than the lead time -- its target instant is already earlier
// than the window's own start, so it can never be caught. That was the
// whole bug: a task scheduled 3 minutes out, with a 5-minute lead, computes
// a target that is always < windowStart, on every single cron tick, forever.
//
// The window is now everything from "right now" through "LEAD minutes from
// now": a task created with plenty of runway still matches for the first
// time at exactly T-lead (same behaviour as before), while a task due
// sooner than the lead time matches on the very next tick instead of being
// silently dropped. sent_reminders still dedupes repeat matches across
// ticks, so widening this is strictly safer, not just a special case.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:reminders@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface TaskRow {
  id: string;
  device_id: string;
  name: string;
  scheduled_time: string | null;
  start_date: string;
  frequency_type: string;
  // deno-lint-ignore no-explicit-any
  frequency_value: any;
  current_streak: number | null;
  amount: number;
  difficulty: number;
  is_hourly: boolean;
  per_minute_rate: number;
}

interface SubRow {
  device_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  tz_offset_minutes: number | null;
  updated_at: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
// Format a Date using its UTC getters as if they were local calendar values.
// Used with a "shifted" Date that already represents the device's local wall clock.
function ymdShifted(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function dayNameShifted(d: Date) {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getUTCDay()];
}

/** Mirrors src/lib/schedule.ts. Kept in sync by hand — Deno cannot import from src/. */
function isMonthDayDue(days: number[], localDate: Date): boolean {
  const dom = localDate.getUTCDate();
  const lastDom = new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth() + 1, 0)).getUTCDate();
  return days.some((d) => d === dom || (d > lastDom && dom === lastDom));
}

function mondayOfShifted(d: Date): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() - ((out.getUTCDay() + 6) % 7));
  return out;
}

function isTaskDueOnShiftedDate(task: TaskRow, localDate: Date): boolean {
  const dateStr = ymdShifted(localDate);
  if (task.start_date > dateStr) return false;
  const dow = localDate.getUTCDay();
  const name = dayNameShifted(localDate);
  const fv = task.frequency_value;
  switch (task.frequency_type) {
    case 'weekly':
      return Array.isArray(fv) && fv.includes(dow);
    case 'monthly':
      return Array.isArray(fv) && isMonthDayDue(fv as number[], localDate);
    case 'every-n-weeks': {
      const v = fv as { interval?: number; days?: number[]; anchor?: string } | null;
      if (!v || !Array.isArray(v.days) || !v.days.includes(dow) || !v.anchor) return false;
      const interval = Math.max(1, Math.floor(v.interval ?? 1));
      if (interval === 1) return true;
      const anchorMonday = mondayOfShifted(new Date(`${v.anchor}T12:00:00Z`));
      const thisMonday = mondayOfShifted(localDate);
      const weeks = Math.abs(Math.round((thisMonday.getTime() - anchorMonday.getTime()) / 86400000 / 7));
      return weeks % interval === 0;
    }
    case 'specific-date':
      return fv === dateStr;
    case 'specific-day':
      return fv === name;
    case 'at-least-weekly':
    case 'at-least-monthly':
      return true;
    default:
      return false;
  }
}

function parseHHmm(t: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const utcNow = new Date();
  const windowEndMs = utcNow.getTime() + REMINDER_LEAD_MIN * 60_000;

  // Load all subscriptions once; keep the most recent tz per device.
  const { data: allSubs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('device_id,endpoint,p256dh,auth,tz_offset_minutes,updated_at')
    .order('updated_at', { ascending: false });
  if (subsErr) return new Response(subsErr.message, { status: 500 });

  const tzByDevice = new Map<string, number>();
  const subsByDevice = new Map<string, SubRow[]>();
  for (const s of (allSubs ?? []) as SubRow[]) {
    if (!subsByDevice.has(s.device_id)) subsByDevice.set(s.device_id, []);
    subsByDevice.get(s.device_id)!.push(s);
    if (!tzByDevice.has(s.device_id) && typeof s.tz_offset_minutes === 'number') {
      tzByDevice.set(s.device_id, s.tz_offset_minutes);
    }
  }

  // 1. Load scheduled tasks (any device with a scheduled_time).
  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('id,device_id,name,scheduled_time,start_date,frequency_type,frequency_value,current_streak,amount,difficulty,is_hourly,per_minute_rate')
    .not('scheduled_time', 'is', null);
  if (tasksErr) return new Response(tasksErr.message, { status: 500 });

  // 2. For each task, compute a timezone-aware target UTC instant and check
  //    if it falls in the [utcNow+5, utcNow+6) window.
  interface DueEntry {
    task: TaskRow;
    localDateStr: string; // device-local YYYY-MM-DD used for dedupe
  }
  const dueTasks: DueEntry[] = [];
  for (const t of (tasks ?? []) as TaskRow[]) {
    if (!t.scheduled_time) continue;
    const hm = parseHHmm(t.scheduled_time);
    if (!hm) continue;

    // Prefer the device's known offset; skip if we truly have no record.
    const offset = tzByDevice.get(t.device_id);
    if (typeof offset !== 'number') continue;

    // Device's "local now" as a shifted Date (read via UTC getters).
    const localNow = new Date(utcNow.getTime() + offset * 60_000);

    if (!isTaskDueOnShiftedDate(t, localNow)) continue;

    // Wall-clock target on the device's local calendar today, converted back
    // to a real UTC instant by subtracting the offset.
    const wallMs = Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate(),
      hm.h,
      hm.m,
      0,
      0,
    );
    const targetUtcMs = wallMs - offset * 60_000;

    // Anywhere from now through the lead time ahead: due soon enough to
    // remind about, not yet started, not so far out it's premature.
    if (targetUtcMs < utcNow.getTime() || targetUtcMs > windowEndMs) continue;

    dueTasks.push({ task: t, localDateStr: ymdShifted(localNow) });
  }

  if (!dueTasks.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Exclude tasks already completed today (task_completions), using each
  //    task's device-local date.
  const dueIds = dueTasks.map((d) => d.task.id);
  const localDates = Array.from(new Set(dueTasks.map((d) => d.localDateStr)));

  const { data: completions } = await supabase
    .from('task_completions')
    .select('task_id,completed_date')
    .in('task_id', dueIds)
    .in('completed_date', localDates);
  const completedKey = new Set(
    (completions ?? []).map((c) => `${c.task_id}|${c.completed_date}`),
  );

  // 4. Dedupe against sent_reminders (per local date).
  const { data: sentRows } = await supabase
    .from('sent_reminders')
    .select('task_id,reminder_date')
    .in('task_id', dueIds)
    .in('reminder_date', localDates)
    .eq('reminder_type', 'pre-5min');
  const sentKey = new Set(
    (sentRows ?? []).map((r) => `${r.task_id}|${r.reminder_date}`),
  );

  const toSend = dueTasks.filter(
    (d) =>
      !completedKey.has(`${d.task.id}|${d.localDateStr}`) &&
      !sentKey.has(`${d.task.id}|${d.localDateStr}`),
  );
  // NOTE: no early return when `toSend` is empty — the evening passes below
  // run on their own schedule and must still be reached on a quiet minute.
  let sentCount = 0;
  const expiredEndpoints: string[] = [];

  for (const { task, localDateStr } of toSend) {
    const deviceSubs = subsByDevice.get(task.device_id) ?? [];
    if (!deviceSubs.length) {
      await supabase.from('sent_reminders').insert({
        device_id: task.device_id,
        task_id: task.id,
        reminder_date: localDateStr,
        reminder_type: 'pre-5min',
      });
      continue;
    }
    const payload = JSON.stringify({
      title: `⏰ ${task.name}`,
      body: `Starting soon — get ready`,
      tag: `${task.id}-${localDateStr}`,
      url: '/',
    });

    let anyOk = false;
    for (const sub of deviceSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        anyOk = true;
        sentCount++;
      } catch (err) {
        // deno-lint-ignore no-explicit-any
        const status = (err as any)?.statusCode;
        if (status === 404 || status === 410) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn('[push] send failed', status, (err as Error).message);
        }
      }
    }

    if (anyOk || deviceSubs.length > 0) {
      const { error } = await supabase.from('sent_reminders').insert({
        device_id: task.device_id,
        task_id: task.id,
        reminder_date: localDateStr,
        reminder_type: 'pre-5min',
      });
      if (error && !error.message.includes('duplicate')) {
        console.warn('[push] mark sent failed', error.message);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Evening passes: streak-risk alerts, and the Sunday digest.
  // Both fire in the device's own local evening, deduped per local date.
  // ---------------------------------------------------------------------
  const extra = await sendEveningAlerts(
    supabase, (tasks ?? []) as TaskRow[], subsByDevice, tzByDevice, completedKey, expiredEndpoints,
  );
  sentCount += extra;

  if (expiredEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
  }

  return new Response(
    JSON.stringify({ ok: true, sent: sentCount, cleaned: expiredEndpoints.length }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});

/** Local hour at which the evening passes fire. */
const EVENING_HOUR = 20;
/** Warn once a task is this close to closing its 7-completion cycle. */
const RISK_AT = 5;
const CYCLE = 7;
const DIFFICULTY_MULTIPLIERS: Record<number, number> = { 1: 1.5, 2: 2, 3: 2.5, 4: 3, 5: 4 };

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// deno-lint-ignore no-explicit-any
async function sendEveningAlerts(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tasks: TaskRow[],
  subsByDevice: Map<string, SubRow[]>,
  tzByDevice: Map<string, number>,
  completedKey: Set<string>,
  expiredEndpoints: string[],
): Promise<number> {
  const now = Date.now();
  let sent = 0;

  for (const [deviceId, subs] of subsByDevice) {
    if (!subs.length) continue;
    const tz = tzByDevice.get(deviceId) ?? 0;
    const local = new Date(now + tz * 60000);
    // Only run in the minute the evening hour begins, so the cron's per-minute
    // cadence cannot fire this repeatedly through the hour.
    if (local.getUTCHours() !== EVENING_HOUR || local.getUTCMinutes() !== 0) continue;

    const localDateStr = ymdShifted(local);
    const isSunday = local.getUTCDay() === 0;
    const deviceTasks = tasks.filter((t) => t.device_id === deviceId);

    // --- streak-risk: due today, not done, and close to a cycle close ---
    const atRisk = deviceTasks.filter((t) => {
      if (!isTaskDueOnShiftedDate(t, local)) return false;
      if (completedKey.has(`${t.id}|${localDateStr}`)) return false;
      const streak = t.current_streak ?? 0;
      return streak >= RISK_AT && streak < CYCLE;
    });

    for (const task of atRisk) {
      const streak = task.current_streak ?? 0;
      const left = CYCLE - streak;
      const mult = DIFFICULTY_MULTIPLIERS[task.difficulty] ?? 1.5;
      const raise = task.is_hourly
        ? 'a +₹0.50/min raise'
        : `a raise to ${money(task.amount * mult)}`;
      const stake = task.is_hourly ? '' : ` Missing it costs ${money(task.amount)}.`;

      const ok = await pushToDevice(supabase, subs, expiredEndpoints, {
        title: `🔥 ${streak}/${CYCLE} — ${task.name}`,
        body: left === 1
          ? `Last one. Finish today to close the cycle and earn ${raise}.${stake}`
          : `${left} to go. Break it now and the streak resets to zero.${stake}`,
        tag: `risk-${task.id}-${localDateStr}`,
        requireInteraction: true,
        renotify: true,
        vibrate: [200, 80, 200, 80, 200],
        url: './',
      });
      if (!ok) continue;
      sent++;
      await markSent(supabase, deviceId, localDateStr, 'streak-risk', task.id);
    }

    // --- Sunday digest ---
    if (!isSunday) continue;
    if (await alreadySent(supabase, deviceId, localDateStr, 'weekly-digest')) continue;

    const weekStart = new Date(local.getTime());
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const weekStartStr = ymdShifted(weekStart);

    const { data: weekRows } = await supabase
      .from('task_completions')
      .select('amount_earned,completed_date,task_id')
      .eq('device_id', deviceId)
      .gte('completed_date', weekStartStr)
      .lte('completed_date', localDateStr);

    const rows = weekRows ?? [];
    // deno-lint-ignore no-explicit-any
    const earned = rows.reduce((a: number, r: any) => a + (Number(r.amount_earned) > 0 ? Number(r.amount_earned) : 0), 0);
    // deno-lint-ignore no-explicit-any
    const done = rows.filter((r: any) => Number(r.amount_earned) > 0).length;
    // deno-lint-ignore no-explicit-any
    const failed = rows.filter((r: any) => Number(r.amount_earned) <= 0).length;

    const body = done === 0 && failed === 0
      ? 'Nothing logged this week. A fresh week starts tomorrow.'
      : `${money(earned)} earned · ${done} done` + (failed ? ` · ${failed} missed` : '') +
        '. Open the Report for the full picture.';

    const ok = await pushToDevice(supabase, subs, expiredEndpoints, {
      title: '📜 Your week',
      body,
      tag: `digest-${localDateStr}`,
      vibrate: [120, 60, 120],
      url: './',
    });
    if (ok) {
      sent++;
      await markSent(supabase, deviceId, localDateStr, 'weekly-digest', null);
    }
  }

  return sent;
}

// deno-lint-ignore no-explicit-any
async function alreadySent(supabase: any, deviceId: string, date: string, type: string): Promise<boolean> {
  const { data } = await supabase
    .from('sent_reminders')
    .select('id')
    .eq('device_id', deviceId)
    .eq('reminder_date', date)
    .eq('reminder_type', type)
    .limit(1);
  return Boolean(data && data.length);
}

// deno-lint-ignore no-explicit-any
async function markSent(supabase: any, deviceId: string, date: string, type: string, taskId: string | null) {
  const { error } = await supabase.from('sent_reminders').insert({
    device_id: deviceId,
    task_id: taskId,
    reminder_date: date,
    reminder_type: type,
  });
  if (error && !error.message.includes('duplicate')) {
    console.warn('[push] mark sent failed', type, error.message);
  }
}

// deno-lint-ignore no-explicit-any
async function pushToDevice(
  // deno-lint-ignore no-explicit-any
  _supabase: any,
  subs: SubRow[],
  expiredEndpoints: string[],
  // deno-lint-ignore no-explicit-any
  payload: Record<string, any>,
): Promise<boolean> {
  const body = JSON.stringify(payload);
  let anyOk = false;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
      anyOk = true;
    } catch (err) {
      // deno-lint-ignore no-explicit-any
      const status = (err as any)?.statusCode;
      if (status === 404 || status === 410) expiredEndpoints.push(sub.endpoint);
      else console.warn('[push] send failed', status, (err as Error).message);
    }
  }
  return anyOk;
}
