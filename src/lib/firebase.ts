import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';

// Replace with your app's Firebase project configuration
// Get these from Firebase Console -> Project Settings
const firebaseConfig = {
    apiKey: "AIzaSyBxKdSXGuMZIZVvrbc9sPn53u9tzgVBeNc",
    authDomain: "stocky-24ce6.firebaseapp.com",
    projectId: "stocky-24ce6",
    storageBucket: "stocky-24ce6.firebasestorage.app",
    messagingSenderId: "289662567244",
    appId: "1:289662567244:web:26909e2908967ce76e45e9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Messaging and get a reference to the service
export const messaging = getMessaging(app);
