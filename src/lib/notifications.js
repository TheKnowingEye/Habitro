import { supabase } from './supabase';

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
  });

  await supabase.from('push_subscriptions').upsert({
    user_id: (await supabase.auth.getUser()).data.user?.id,
    subscription: JSON.stringify(subscription),
  });

  return subscription;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
