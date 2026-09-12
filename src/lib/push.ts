import { supabase } from '@/integrations/supabase/client';

/**
 * Web Push subscription plumbing.
 *
 * Works on Chrome/Edge/Firefox on desktop and Android straight from the
 * browser. On iOS it works only once the site has been added to the Home
 * Screen — Safari refuses `pushManager.subscribe` in a normal tab — which is
 * why `pushSupport()` reports that case separately rather than just "no".
 */

const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

export type PushBlockReason = 'unsupported' | 'ios-needs-install' | 'no-vapid-key' | 'denied';

/** A single shape rather than a discriminated union: this project compiles with
 *  `strict: false`, where narrowing on a boolean literal is not dependable. */
export interface PushSupport {
  ok: boolean;
  reason?: PushBlockReason;
}

function isIos(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (isIos() && !isStandalone()) return { ok: false, reason: 'ios-needs-install' };
    return { ok: false, reason: 'unsupported' };
  }
  if (isIos() && !isStandalone()) return { ok: false, reason: 'ios-needs-install' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid-key' };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  return { ok: true };
}

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The registration the app created at startup, waited until it is active. */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // `sw.js` sits beside index.html, so resolve it against the document rather
  // than "/" — the site is served from a subpath on GitHub Pages.
  return navigator.serviceWorker.register(new URL('sw.js', document.baseURI).toString(), {
    scope: new URL('./', document.baseURI).toString(),
  });
}

function keyToBase64(sub: PushSubscription, name: 'p256dh' | 'auth'): string {
  const key = sub.getKey(name);
  if (!key) return '';
  return btoa(String.fromCharCode(...new Uint8Array(key)));
}

export async function isPushEnabled(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  return Boolean(await reg.pushManager.getSubscription());
}

/**
 * Ask for permission, subscribe, and record the subscription against this
 * device. Safe to call repeatedly — the row is keyed on the endpoint.
 */
export async function enablePush(deviceId: string): Promise<PushSupport> {
  const support = pushSupport();
  if (!support.ok) return support;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      device_id: deviceId,
      endpoint: sub.endpoint,
      p256dh: keyToBase64(sub, 'p256dh'),
      auth: keyToBase64(sub, 'auth'),
      // The sender needs the device's wall clock to fire at the right local time.
      tz_offset_minutes: -new Date().getTimezoneOffset(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) {
    console.error('[push] could not save subscription', error);
    return { ok: false, reason: 'unsupported' };
  }
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
