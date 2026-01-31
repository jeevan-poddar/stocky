// Scripts for firebase messaging
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing the messagingSenderId.
// Read more: https://firebase.google.com/docs/cloud-messaging/js/client#initialize_the_firebase_sdk_in_the_service_worker
firebase.initializeApp({
apiKey: "AIzaSyBxKdSXGuMZIZVvrbc9sPn53u9tzgVBeNc",
  authDomain: "stocky-24ce6.firebaseapp.com",
  projectId: "stocky-24ce6",
  storageBucket: "stocky-24ce6.firebasestorage.app",
  messagingSenderId: "289662567244",
  appId: "1:289662567244:web:26909e2908967ce76e45e9"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg',
    // data is crucial for click handling
    data: payload.data 
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification.data);
  
  event.notification.close();

  // URL to open
  const targetUrl = event.notification.data?.url;

  if (targetUrl) {
      // This looks to see if the current is already open and focuses if it is
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
          // Check if there is already a window/tab open with the target URL
          for (var i = 0; i < windowClients.length; i++) {
            var client = windowClients[i];
            // Basic check if client url contains our base url or target
            if (client.url === targetUrl && 'focus' in client) {
              return client.focus();
            }
          }
          // If not, open a new window
          if (clients.openWindow) {
            return clients.openWindow(targetUrl);
          }
        })
      );
  }
});
