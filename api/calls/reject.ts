import type { IncomingMessage, ServerResponse } from 'http';
import { serverSupabase, memoryCallSessions, webpush } from '../_lib/webpush';

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
  const { callId, callerId, receiverId } = payload || {};

  if (!callId) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'callId is required' }));
    return;
  }

  // 1. Update memory session
  const memSession = memoryCallSessions.get(callId);
  if (memSession) {
    memSession.status = 'rejected';
    memSession.updated_at = new Date().toISOString();
  }

  // 2. Update Supabase call_sessions table
  try {
    await serverSupabase
      .from('call_sessions')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', callId);
  } catch (err: any) {
    console.warn('[Call Reject API] DB update notice:', err.message);
  }

  // 3. Broadcast rejection event to caller via Supabase Realtime channel
  const effectiveCallerId = callerId || memSession?.caller_id;
  if (effectiveCallerId) {
    try {
      const channel = serverSupabase.channel(`call_room_${effectiveCallerId}`);
      await channel.send({
        type: 'broadcast',
        event: 'call-rejected',
        payload: {
          callId,
          reason: 'rejected',
        },
      });
    } catch (realtimeErr) {
      console.warn('[Call Reject API] Realtime broadcast notice:', realtimeErr);
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: true, message: 'Call rejected successfully.', callId }));
}
