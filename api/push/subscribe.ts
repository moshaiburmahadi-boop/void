import type { IncomingMessage, ServerResponse } from 'http';
import { serverSupabase, memorySubscriptions } from '../_lib/webpush';

// Helper to parse JSON body from incoming request
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
  const { userId, subscription } = payload || {};

  if (!userId || !subscription || !subscription.endpoint) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing userId or valid subscription object' }));
    return;
  }

  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh || '';
  const auth = subscription.keys?.auth || '';

  // 1. In-memory cache
  const userSubs = memorySubscriptions.get(userId) || [];
  const filtered = userSubs.filter((s) => s.endpoint !== endpoint);
  filtered.push({ endpoint, keys: { p256dh, auth } });
  memorySubscriptions.set(userId, filtered);

  // 2. Persist in Supabase push_subscriptions table
  try {
    const { error } = await serverSupabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: req.headers['user-agent'] || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.warn('[Subscribe API] Supabase upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Subscribe API] Exception during DB save:', err.message);
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: true, message: 'Push subscription stored successfully.' }));
}
