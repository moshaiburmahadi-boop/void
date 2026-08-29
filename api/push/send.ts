import type { IncomingMessage, ServerResponse } from 'http';
import { webpush, serverSupabase, memorySubscriptions } from '../_lib/webpush';

async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const payload = await parseBody(req);
  const {
    targetUserId,
    type = 'message',
    title = 'Void Notification',
    body = '',
    icon = '/icon-192.png',
    badge = '/icon-192.png',
    tag,
    data = {},
    actions,
    requireInteraction,
    renotify,
    vibrate,
    silent,
  } = payload || {};

  if (!targetUserId) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'targetUserId is required' }));
    return;
  }

  // 1. Gather all push subscriptions for this user
  const subscriptionsToNotify: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> = [];

  // Add in-memory subscriptions if present
  if (memorySubscriptions.has(targetUserId)) {
    const memList = memorySubscriptions.get(targetUserId) || [];
    subscriptionsToNotify.push(...memList);
  }

  // Add DB subscriptions from Supabase
  try {
    const { data: dbSubs, error: dbErr } = await serverSupabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', targetUserId);

    if (!dbErr && Array.isArray(dbSubs)) {
      for (const s of dbSubs) {
        if (!subscriptionsToNotify.some((existing) => existing.endpoint === s.endpoint)) {
          subscriptionsToNotify.push({
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[Push Send API] Error querying subscriptions:', err.message);
  }

  if (subscriptionsToNotify.length === 0) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        sentCount: 0,
        message: 'No active push subscriptions found for this user.',
      })
    );
    return;
  }

  // 2. Prepare standardized Web Push notification payload
  const pushNotificationPayload = JSON.stringify({
    type,
    title,
    body,
    icon: icon || '/icon-192.png',
    badge: badge || '/icon-192.png',
    tag: tag || (type === 'incoming_call' ? `call_${data.callId || 'unknown'}` : `void_${Date.now()}`),
    data: {
      ...data,
      type,
      url: data.url || (type === 'incoming_call' ? `/call/${data.callId}` : '/'),
    },
    actions: actions || (type === 'incoming_call' ? [
      { action: 'accept-call', title: 'Receive', icon: '/icon-192.png' },
      { action: 'reject-call', title: 'Reject', icon: '/icon-192.png' },
    ] : []),
    requireInteraction: type === 'incoming_call' ? true : Boolean(requireInteraction),
    renotify: type === 'incoming_call' ? true : Boolean(renotify),
    vibrate: vibrate || (type === 'incoming_call' ? [300, 150, 300, 150, 300, 150, 600] : [200, 100, 200]),
    silent: Boolean(silent),
  });

  // 3. Dispatch to all active endpoints
  let sentCount = 0;
  const expiredEndpoints: string[] = [];

  await Promise.all(
    subscriptionsToNotify.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          pushNotificationPayload,
          {
            TTL: type === 'incoming_call' ? 45 : 86400, // Short TTL for calls, 24h for messages
            urgency: type === 'incoming_call' ? 'high' : 'normal',
          }
        );
        sentCount++;
      } catch (pushErr: any) {
        console.warn('[WebPush] Send error:', pushErr.statusCode, pushErr.message);
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    try {
      await serverSupabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    } catch {
      // Non-blocking
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      success: true,
      sentCount,
      totalEndpoints: subscriptionsToNotify.length,
    })
  );
}
