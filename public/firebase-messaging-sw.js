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
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
