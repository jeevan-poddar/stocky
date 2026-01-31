import { useEffect, useState } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging } from '../lib/firebase';

const useFcmToken = () => {
  const [token, setToken] = useState<string | null>(null);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    const retrieveToken = async () => {
      try {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
          const permission = await Notification.requestPermission();
          setNotificationPermissionStatus(permission);

          if (permission === 'granted') {
            const currentToken = await getToken(messaging, {
              vapidKey: 'BB80PbV6j0HSEt7o_Fh5IKRF6DduEd-gxcDcZZMbciyU8-ug2ccPZfVHH_8ahY92O9ZuClNUMv0L8feGGeu9G-M' 
            });
            if (currentToken) {
                console.log('Use this string to send notifications:', currentToken);
                setToken(currentToken);
                // TODO: Save this token to your database
            } else {
              console.log('No registration token available. Request permission to generate one.');
            }
          }
        }
      } catch (error) {
        console.log('An error occurred while retrieving token. ', error);
      }
    };

    retrieveToken();
  }, []);

  return { fcmToken: token, notificationPermissionStatus };
};

export default useFcmToken;
