/* TaskStreak push service worker.
 *
 * Deliberately plain JS with no build step: it is served as-is from the site
 * root-relative path the app registers, and a service worker cannot be a
 * module bundle without extra tooling.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'TaskStreak', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'TaskStreak';
  const options = {
    body: data.body || '',
    // `tag` collapses repeats of the same alert instead of stacking them.
    tag: data.tag || 'taskstreak',
    renotify: Boolean(data.renotify),
    // Streak-risk alerts stay on screen until acknowledged; routine ones don't.
    requireInteraction: Boolean(data.requireInteraction),
    icon: data.icon || './favicon.ico',
    badge: data.badge || './favicon.ico',
    vibrate: data.vibrate || [100, 50, 100],
    timestamp: data.timestamp || Date.now(),
    data: { url: data.url || './', ...(data.data || {}) },
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus an already-open tab rather than opening a duplicate.
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', action: event.action, url: target });
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
