import { useEffect, useState } from 'react';
import { getToken } from 'firebase/messaging';
import { getMessagingInstance } from '../lib/firebase'; // Change this import
import { supabase } from '../lib/supabase';

const useFcmToken = () => {
  const [token, setToken] = useState<string | null>(null);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    const retrieveToken = async () => {
      try {
        // 1. Check for basic browser support
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {

          // 2. Safely get the messaging instance (handles insecure origin/IP issues)
          const messaging = await getMessagingInstance();

          if (!messaging) {
            console.warn('Push messaging is not supported or blocked by insecure origin.');
            return;
          }

          // 3. Request permission
          const permission = await Notification.requestPermission();
          setNotificationPermissionStatus(permission);

          if (permission === 'granted') {
            const currentToken = await getToken(messaging, {
              vapidKey: 'BB80PbV6j0HSEt7o_Fh5IKRF6DduEd-gxcDcZZMbciyU8-ug2ccPZfVHH_8ahY92O9ZuClNUMv0L8feGGeu9G-M'
            });

            if (currentToken) {
              setToken(currentToken);

              // 4. Upsert Token to Supabase
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const { error } = await supabase
                  .from('fcm_tokens')
                  .upsert(
                    {
                      user_id: user.id,
                      token: currentToken,
                      last_updated_at: new Date().toISOString()
                    },
                    { onConflict: 'token' }
                  );

                if (error) {
                  console.error('Error saving FCM token:', error);
                } else {
                  console.log('FCM Token synced for device.');
                }
              }
            }
          }
        }
      } catch (error) {
        // This catch block now handles the Firebase "unsupported browser" error gracefully
        console.error('Notification setup failed:', error);
      }
    };

    retrieveToken();
  }, []);

  return { fcmToken: token, notificationPermissionStatus };
};

export default useFcmToken;