import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BOKTdCmBizVe9CCL0RuuptUyRSI1nPzLAW86NZe9eOG50Eq2wBIDJ3QgYz9t8ZA4nEr7zDwJfmSly5LoT2shnE8';

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'VsQs_dcrboOV4J_joskSlQHHyAiakH0SLXy_BOIdw0c';

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ||
  'mailto:notifications@void.social';

// Configure Web Push with VAPID credentials
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn('[WebPush] Error initializing VAPID details:', err);
}

// Backend Supabase client for Serverless Functions
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://immhnisokolbwgcnkfqj.supabase.co';

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltbWhuaXNva29sYndnY25rZnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTUwNzcsImV4cCI6MjEwMzU5MTA3N30.R5XNVHBc7LTeDJYfpBSBL3kVGXrGnB8JgzEzzA5NbA4';

export const serverSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// In-memory fallback for push subscriptions and call sessions if database table is not yet provisioned
export const memorySubscriptions = new Map<string, Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>>();
export const memoryCallSessions = new Map<string, any>();

export { webpush };
