import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PushNotificationPayload } from '../types';

export const DEFAULT_VAPID_PUBLIC_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY) ||
  'BOKTdCmBizVe9CCL0RuuptUyRSI1nPzLAW86NZe9eOG50Eq2wBIDJ3QgYz9t8ZA4nEr7zDwJfmSly5LoT2shnE8';

/**
 * Converts a URL-safe Base64 string to a Uint8Array for Web Push applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether the current browser and environment support Web Push notifications
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Gets current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Requests notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Push Notifications are not supported in this browser.');
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Retrieves the current push subscription if active
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch (err) {
    console.warn('Error checking existing push subscription:', err);
    return null;
  }
}

/**
 * Subscribes the current device/browser to Web Push notifications and saves to backend
 */
export async function subscribeUserToPush(userId: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn('PushManager is not supported on this platform/browser.');
    return null;
  }

  // 1. Request permission if not already granted
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Push notification permission denied.');
      return null;
    }
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // If already subscribed, ensure server is up to date
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(DEFAULT_VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    if (!subscription) {
      throw new Error('Failed to create push subscription object.');
    }

    const subJSON = subscription.toJSON();
    const endpoint = subscription.endpoint;
    const p256dh = subJSON.keys?.p256dh || '';
    const auth = subJSON.keys?.auth || '';

    // 2. Persist subscription in Supabase push_subscriptions table
    if (isSupabaseConfigured && userId) {
      try {
        await supabase.from('push_subscriptions').upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );
      } catch (dbErr) {
        console.warn('Database save push subscription notice:', dbErr);
      }
    }

    // 3. Inform API endpoint as well for serverless cache/storage
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: subJSON,
        }),
      });
    } catch (apiErr) {
      // API fallback is non-blocking
    }

    // Store push status locally
    localStorage.setItem('void_push_subscribed', 'true');
    return subscription;
  } catch (err) {
    console.error('Error subscribing to push notifications:', err);
    throw err;
  }
}

/**
 * Unsubscribes current user/browser from Web Push notifications
 */
export async function unsubscribeUserFromPush(userId?: string): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Remove from Supabase
      if (isSupabaseConfigured && userId) {
        try {
          await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
        } catch (dbErr) {
          console.warn('Error deleting push subscription from DB:', dbErr);
        }
      }

      // Remove from API
      try {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, userId }),
        });
      } catch (e) {
        // Non-blocking
      }
    }

    localStorage.removeItem('void_push_subscribed');
    return true;
  } catch (err) {
    console.warn('Error unsubscribing push:', err);
    return false;
  }
}

/**
 * Sends a background Push Notification to a target user via API endpoint / Web Push
 */
export async function dispatchPushNotification(payload: {
  targetUserId: string;
  type: 'message' | 'incoming_call' | 'social' | 'call_rejected' | 'call_ended';
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data: Record<string, any>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  requireInteraction?: boolean;
  renotify?: boolean;
  vibrate?: number[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Push notification dispatch error:', err);
    return { success: false, error: err.message || 'Network error' };
  }
}

/**
 * Triggers a safe local system notification via ServiceWorker or Notification API
 */
export async function showLocalSystemNotification(
  title: string,
  options: NotificationOptions & {
    data?: any;
    actions?: Array<{ action: string; title: string; icon?: string }>;
    requireInteraction?: boolean;
    renotify?: boolean;
    vibrate?: number[];
  } = {}
): Promise<boolean> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
      });
      return true;
    } else {
      new Notification(title, {
        icon: '/icon-192.png',
        ...options,
      });
      return true;
    }
  } catch (err) {
    console.warn('Error showing local system notification:', err);
    return false;
  }
}
