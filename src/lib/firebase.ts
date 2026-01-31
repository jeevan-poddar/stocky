import { initializeApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

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

// Initialize messaging conditionally
export const getMessagingInstance = async () => {
    // isSupported() checks for both HTTPS and browser compatibility
    if (typeof window !== 'undefined' && await isSupported()) {
        return getMessaging(app);
    }
    return null;
};