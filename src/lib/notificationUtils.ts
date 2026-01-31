// import { messaging } from './firebase';
// import { getToken } from 'firebase/messaging';

export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Get Token if needed for backend
      // const token = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });
      // console.log('FCM Token:', token);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error requesting permission:', error);
    return false;
  }
};

export const showSystemNotification = (title: string, body: string) => {
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notification');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/stocky-logo.png', // Assuming a logo exists or use a default
    });
  }
};

// Placeholder for the actual FCM Send function (Requires Backend/Edge Function)
// In a real production environment, you would call your API here.
export const triggerLowStockAlert = async (medicineName: string, currentStock: number) => {
   // 1. Show Local System Notification Immediately (Instant Feedback)
   showSystemNotification(
      'Stocky: Low Stock Alert',
      `${medicineName} has dropped to ${currentStock} boxes. Restock soon.`
   );

   // 2. Call Backend to send FCM to other devices (Mock)
   // await fetch('/api/send-fcm', { ... });
   console.log(`[Mock] Sending FCM Payload for ${medicineName}`);
};
