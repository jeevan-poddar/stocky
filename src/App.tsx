import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onMessage } from 'firebase/messaging';
import { messaging } from './lib/firebase';
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

import { checkInventoryNotifications } from './lib/inventoryUtils';

function App() {
  // Initialize FCM Token and Permission
  const { notificationPermissionStatus } = useFcmToken();

  // Handle Foreground Messages
  useEffect(() => {
    if (notificationPermissionStatus === 'granted') {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Foreground Message received: ', payload);
        const { title, body } = payload.notification || {};
        // You can replace this with a toast notification
        alert(`New Message: ${title} - ${body}`);
      });
      return () => unsubscribe();
    }
  }, [notificationPermissionStatus]);

  // Check Inventory Notifications
  useEffect(() => {
    const runCheck = async () => {
      const messages = await checkInventoryNotifications();
      if (messages && messages.length > 0) {
        // Concatenate for simple alert
        const combinedMessage = messages.map(m => `${m.title}: ${m.message}`).join('\n\n');
        
        console.log("Inventory Alerts:", combinedMessage);
        setTimeout(() => alert(combinedMessage), 1000);
      }
    };
    runCheck();
  }, []);

  return (
    <Router>
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
          <Route path="settings" element={<Settings />} />
          
          {/* Default redirect to dashboard */}
          <Route index element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Catch all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
