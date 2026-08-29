// Void PWA Service Worker
const CACHE_VERSION = 'void-pwa-v1';
const CACHE_NAME = `void-app-${CACHE_VERSION}`;

// Pre-cached static core assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-icon-512.png',
  '/apple-touch-icon.png',
  '/logo.png'
];

// Domains and URL patterns to NEVER cache (Realtime, Supabase, APIs, Auth)
const BYPASS_URL_PATTERNS = [
  'supabase.co',
  '/api/',
  '/auth/',
  'googletagmanager.com',
  'google-analytics.com'
];

// 1. Install event: pre-cache application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[PWA SW] Pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate event: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((existingCacheName) => {
          if (existingCacheName !== CACHE_NAME) {
            console.log('[PWA SW] Removing outdated cache:', existingCacheName);
            return caches.delete(existingCacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch event: optimized caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Bypass API, WebSocket, Supabase, and dynamic database requests
  const shouldBypass = BYPASS_URL_PATTERNS.some((pattern) => request.url.includes(pattern));
  if (shouldBypass) {
    return;
  }

  // Handle navigation requests (SPA HTML entry)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, serve cached SPA shell
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const cachedReq = await caches.match(request);
          if (cachedReq) return cachedReq;
          return new Response('Offline - Void is currently offline.', {
            status: 503,
            statusText: 'Offline',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        })
    );
    return;
  }

  // Handle static assets (JS, CSS, fonts, images)
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});

// 4. Message event: allow clients to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 5. Push event: handle background Web Push notifications (Messages, Calls, Social)
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[PWA SW] Push event received with no payload data.');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: 'Void Notification',
      body: event.data.text(),
      data: { url: '/' },
    };
  }

  const {
    type = 'message',
    title = 'Void',
    body = '',
    icon = '/icon-192.png',
    badge = '/icon-192.png',
    tag,
    data = {},
    actions = [],
    requireInteraction = false,
    renotify = false,
    vibrate,
    silent = false,
  } = payload;

  // Handle call ended/cancelled while ringing: auto-dismiss ringing notification
  if (type === 'call_ended' || type === 'call_rejected') {
    const callId = data?.callId;
    if (callId) {
      event.waitUntil(
        self.registration.getNotifications({ tag: `call_${callId}` }).then((notifications) => {
          notifications.forEach((n) => n.close());
        })
      );
      return;
    }
  }

  // Determine configuration based on notification type
  let notificationOptions = {
    body,
    icon: icon || '/icon-192.png',
    badge: badge || '/icon-192.png',
    tag: tag || (type === 'incoming_call' ? `call_${data.callId || 'unknown'}` : `void_${Date.now()}`),
    data: {
      ...data,
      type,
      url: data.url || (type === 'incoming_call' ? `/call/${data.callId}` : '/'),
    },
    requireInteraction: type === 'incoming_call' ? true : requireInteraction,
    renotify: type === 'incoming_call' ? true : renotify,
    vibrate: vibrate || (type === 'incoming_call' ? [300, 150, 300, 150, 300, 150, 600] : [200, 100, 200]),
    silent,
    actions: actions.length > 0
      ? actions
      : type === 'incoming_call'
      ? [
          { action: 'accept-call', title: 'Receive', icon: '/icon-192.png' },
          { action: 'reject-call', title: 'Reject', icon: '/icon-192.png' },
        ]
      : [],
  };

  const notificationPromise = self.registration.showNotification(title, notificationOptions);
  event.waitUntil(notificationPromise);
});

// 6. Notification Click event: handle interactive notification actions (Accept, Reject, Open Message, Open Route)
self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  const notifData = notification.data || {};
  const notificationType = notifData.type;

  // Always close notification after user acts
  notification.close();

  // Action 1: Reject Incoming Call in Background
  if (action === 'reject-call') {
    const callId = notifData.callId;
    const callerId = notifData.senderId || notifData.callerId;
    const receiverId = notifData.receiverId;

    event.waitUntil(
      (async () => {
        try {
          // Notify backend/signaling of call rejection
          await fetch('/api/calls/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callId,
              callerId,
              receiverId,
              reason: 'user_declined_from_notification',
            }),
          });
        } catch (err) {
          console.warn('[PWA SW] Reject call fetch error:', err);
        }

        // Notify any active clients that call was rejected
        const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        windowClients.forEach((client) => {
          client.postMessage({
            type: 'CALL_REJECTED_BG',
            callId,
            action: 'reject-call',
          });
        });
      })()
    );
    return;
  }

  // Action 2: Accept Call or Default Notification Click (Open / Focus App)
  let targetUrl = notifData.url || '/';
  if (action === 'accept-call') {
    // Append autoAccept query or hash to immediately connect call upon open
    const separator = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${separator}autoAccept=true&action=accept`;
  }

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Look for an existing client window to focus
      for (const client of windowClients) {
        // Send message to the client to switch tabs or start call
        client.postMessage({
          type: 'NOTIFICATION_CLICK',
          action,
          data: notifData,
          url: targetUrl,
        });

        if ('focus' in client) {
          await client.focus();
          return client.navigate(targetUrl);
        }
      }

      // If no window is currently open, open a new browser window/PWA client
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// 7. Notification Close event: handle dismissal
self.addEventListener('notificationclose', (event) => {
  const notifData = event.notification.data || {};
  if (notifData.type === 'incoming_call' && notifData.callId) {
    // Notify clients of notification dismissal if needed
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'NOTIFICATION_DISMISSED',
          callId: notifData.callId,
        });
      });
    });
  }
});
