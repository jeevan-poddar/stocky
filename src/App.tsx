import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onMessage } from 'firebase/messaging';
import { getMessagingInstance } from './lib/firebase';
import useFcmToken from './hooks/useFcmToken';
import AuthLayout from './components/AuthLayout';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Inventory from './pages/Inventory';
import Billing from './pages/Billing';
import Dashboard from './pages/Dashboard';
import SalesHistory from './pages/SalesHistory';
import Returns from './pages/Returns';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';

import { checkInventoryNotifications } from './lib/inventoryUtils';

import { useNavigate } from 'react-router-dom';
import { ToastProvider, useToast } from './context/ToastContext';
import { InventoryProvider, useInventory } from './context/InventoryContext';

function AppContent() {
  const { notificationPermissionStatus } = useFcmToken();
  const { sendNotification } = useToast();
  const { triggerRefresh } = useInventory();
  const navigate = useNavigate();

  // Handle Foreground Messages
  useEffect(() => {
    const setupMessaging = async () => {
      if (notificationPermissionStatus === 'granted') {
        const messaging = await getMessagingInstance();
        
        if (messaging) {
          const unsubscribe = onMessage(messaging, (payload) => {
            console.log('Foreground Message received: ', payload);
            const { title, body } = payload.notification || {};
            const { medicine_id, url } = payload.data || {};

            // 1. Instant Notification "Throw" (Toast + Alert)
            if (title && body) {
              
              // Determine Action
              let action = undefined;
              if (url) {
                  action = {
                      label: 'View Returns',
                      onClick: () => navigate(url)
                  };
              }

              // Toast with Action
              sendNotification(`${title}: ${body}`, 'warning', action);
              
               if ('Notification' in window && Notification.permission === 'granted') {
                   new Notification(title, { 
                       body, 
                       icon: '/stocky-logo.png' 
                   });
               }
            }

            // 2. Instant Inventory Check (Sync)
            if (medicine_id) {
                triggerRefresh();
            }
          });
          return () => unsubscribe();
        }
      }
    };
    
    setupMessaging();
  }, [notificationPermissionStatus, sendNotification, triggerRefresh, navigate]);

  // Check Inventory Notifications
  useEffect(() => {
    const runCheck = async () => {
      const messages = await checkInventoryNotifications();
      if (messages && messages.length > 0) {
        // Concatenate for simple alert
        // const combinedMessage = messages.map(m => `${m.title}: ${m.message}`).join('\n\n');
        
        // console.log("Inventory Alerts:", combinedMessage);
        // Alert removed
      }
    };
    runCheck();
  }, []);

  return (
      <Routes>
        {/* Public Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
        </Route>

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="billing" element={<Billing />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales-history" element={<SalesHistory />} />
          <Route path="returns" element={<Returns />} />
          <Route path="returns" element={<Returns />} />
          <Route path="settings" element={<Settings />} />
          <Route path="notifications" element={<Notifications />} />
          
          {/* Default redirect to dashboard */}
          <Route index element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Catch all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
  );
}

function App() {
  return (
    <ToastProvider>
      <InventoryProvider>
        <Router>
             <AppContent />
        </Router>
      </InventoryProvider>
    </ToastProvider>
  );
}

export default App;
