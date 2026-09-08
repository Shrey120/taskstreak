// Sends Web Push reminders 5 minutes before each due task's scheduled time.
// Invoked every minute by pg_cron. Idempotent via public.sent_reminders.
// Timezone-aware: each push_subscription stores tz_offset_minutes (minutes
// east of UTC, e.g. IST = 330). Task scheduled_time is a wall-clock "HH:MM"
// in the device's LOCAL timezone, so we shift accordingly when computing
// due-date, target instant, and reminder_date.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const REMINDER_LEAD_MIN = 5;
const WINDOW_MIN = 1; // matches cron cadence

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

function isTaskDueOnShiftedDate(task: TaskRow, localDate: Date): boolean {
  const dateStr = ymdShifted(localDate);
  if (task.start_date > dateStr) return false;
  const dow = localDate.getUTCDay();
  const dom = localDate.getUTCDate();
  const name = dayNameShifted(localDate);
  const fv = task.frequency_value;
  switch (task.frequency_type) {
    case 'weekly':
      return Array.isArray(fv) && fv.includes(dow);
    case 'monthly':
      return Array.isArray(fv) && fv.includes(dom);
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
  const windowStartMs = utcNow.getTime() + REMINDER_LEAD_MIN * 60_000;
  const windowEndMs = windowStartMs + WINDOW_MIN * 60_000;

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
    .select('id,device_id,name,scheduled_time,start_date,frequency_type,frequency_value')
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

    if (targetUtcMs < windowStartMs || targetUtcMs >= windowEndMs) continue;

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
  const { data: alreadySent } = await supabase
    .from('sent_reminders')
    .select('task_id,reminder_date')
    .in('task_id', dueIds)
    .in('reminder_date', localDates)
    .eq('reminder_type', 'pre-5min');
  const sentKey = new Set(
    (alreadySent ?? []).map((r) => `${r.task_id}|${r.reminder_date}`),
  );

  const toSend = dueTasks.filter(
    (d) =>
      !completedKey.has(`${d.task.id}|${d.localDateStr}`) &&
      !sentKey.has(`${d.task.id}|${d.localDateStr}`),
  );
  if (!toSend.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

  if (expiredEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
  }

  return new Response(
    JSON.stringify({ ok: true, sent: sentCount, cleaned: expiredEndpoints.length }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
