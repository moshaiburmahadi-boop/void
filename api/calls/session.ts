import type { IncomingMessage, ServerResponse } from 'http';
import { serverSupabase, memoryCallSessions } from '../_lib/webpush';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // GET: Fetch session details
  if (req.method === 'GET') {
    const url = new URL(req.url || '/', 'http://localhost');
    const callId = url.searchParams.get('callId');

    if (!callId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'callId is required' }));
      return;
    }

    const session = memoryCallSessions.get(callId);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ session: session || null }));
    return;
  }

  // POST: Create new call session
  if (req.method === 'POST') {
    const payload = await parseBody(req);
    const { id, callerId, receiverId, callType = 'audio', offer } = payload || {};

    if (!id || !callerId || !receiverId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing id, callerId, or receiverId' }));
      return;
    }

    const sessionData = {
      id,
      caller_id: callerId,
      receiver_id: receiverId,
      call_type: callType,
      status: 'calling',
      offer: offer || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryCallSessions.set(id, sessionData);

    try {
      await serverSupabase.from('call_sessions').upsert(sessionData);
    } catch (err: any) {
      console.warn('[Call Session API] DB insert notice:', err.message);
    }

    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, session: sessionData }));
    return;
  }

  // PUT: Update call session state (e.g. status, answer, duration)
  if (req.method === 'PUT') {
    const payload = await parseBody(req);
    const { id, status, answer, durationSeconds } = payload || {};

    if (!id) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'id is required' }));
      return;
    }

    const current = memoryCallSessions.get(id) || { id };
    const updated = {
      ...current,
      ...(status ? { status } : {}),
      ...(answer ? { answer } : {}),
      ...(typeof durationSeconds === 'number' ? { duration_seconds: durationSeconds } : {}),
      updated_at: new Date().toISOString(),
    };
    memoryCallSessions.set(id, updated);

    try {
      await serverSupabase.from('call_sessions').update(updated).eq('id', id);
    } catch (err: any) {
      console.warn('[Call Session API] DB update notice:', err.message);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, session: updated }));
    return;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}
