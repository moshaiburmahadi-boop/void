import type { IncomingMessage, ServerResponse } from 'http';
import { serverSupabase, memoryCallSessions } from '../_lib/webpush';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const callId = url.searchParams.get('callId');

  if (!callId) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'callId query parameter is required' }));
    return;
  }

  // 1. Check memory cache
  const memSession = memoryCallSessions.get(callId);

  // 2. Check Supabase
  let dbSession = null;
  try {
    const { data, error } = await serverSupabase
      .from('call_sessions')
      .select('*, caller_profile:caller_id(*), receiver_profile:receiver_id(*)')
      .eq('id', callId)
      .maybeSingle();

    if (!error && data) {
      dbSession = data;
    }
  } catch (err: any) {
    console.warn('[Call Status API] DB query notice:', err.message);
  }

  const session = dbSession || memSession;

  if (!session) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        status: 'not_found',
        callId,
        isActive: false,
        message: 'Call session not found or has expired.',
      })
    );
    return;
  }

  const isCallActive = session.status === 'calling' || session.status === 'ringing' || session.status === 'accepted';

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      callId,
      status: session.status,
      callType: session.call_type || session.callType || 'audio',
      isActive: isCallActive,
      session,
    })
  );
}
