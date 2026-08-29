import type { IncomingMessage, ServerResponse } from 'http';
import { serverSupabase, memorySubscriptions } from '../_lib/webpush';

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
  const { endpoint, userId } = payload || {};

  if (!endpoint) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint is required to unsubscribe' }));
    return;
  }

  // 1. Remove from memory cache
  if (userId && memorySubscriptions.has(userId)) {
    const list = memorySubscriptions.get(userId) || [];
    memorySubscriptions.set(
      userId,
      list.filter((s) => s.endpoint !== endpoint)
    );
  }

  // 2. Remove from Supabase
  try {
    await serverSupabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (err: any) {
    console.warn('[Unsubscribe API] Supabase delete notice:', err.message);
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: true, message: 'Unsubscribed successfully.' }));
}
