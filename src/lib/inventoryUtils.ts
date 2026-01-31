import { supabase } from './supabase';
import { addDays, format, startOfToday } from 'date-fns';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'error';
}

export async function checkInventoryNotifications(): Promise<NotificationItem[]> {
  try {
    // 1. Fetch Settings (Profile)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('expiry_threshold_days, low_stock_threshold')
      .limit(1)
      .maybeSingle();

    if (profileError || !profile) {
      // console.log('No profile settings found, skipping notification check.');
      return [];
    }

    const { expiry_threshold_days, low_stock_threshold } = profile;
    const defaultLowStock = low_stock_threshold ?? 10;
    const defaultExpiryDays = expiry_threshold_days ?? 30;

    const notifications: NotificationItem[] = [];

    const today = startOfToday();
    const todayStr = format(today, 'yyyy-MM-dd');

    // 2. Low Stock Check
    // Query medicines where stock_packets <= threshold AND expiry_date >= today
    const { data: lowStockItems, error: stockError } = await supabase
      .from('medicines')
      .select('name, stock_packets')
      .lte('stock_packets', defaultLowStock)
      .gte('expiry_date', todayStr) // Exclude already expired items from restock alerts
      .limit(5); // Limit to avoid massive lists

    if (!stockError && lowStockItems) {
      lowStockItems.forEach(item => {
        notifications.push({
          id: `low-stock-${item.name}-${Date.now()}`,
          title: 'Restock Needed',
          message: `${item.name} is below limit (${item.stock_packets} / ${defaultLowStock})`,
          type: 'warning'
        });
      });
    }

    // 3. Expired Items Check (Already Expired)
    const { data: expiredItems, error: expiredError } = await supabase
      .from('medicines')
      .select('name, expiry_date')
      .lt('expiry_date', todayStr)
      .order('expiry_date', { ascending: true })
      .limit(5);

    if (!expiredError && expiredItems) {
      expiredItems.forEach(item => {
        notifications.push({
          id: `expired-${item.name}-${Date.now()}`,
          title: 'EXPIRED',
          message: `${item.name} expired on ${item.expiry_date}`,
          type: 'error'
        });
      });
    }

    // 4. Expiring Soon Check
    // Alert Date = Today + threshold
    const alertDate = addDays(today, defaultExpiryDays);
    const alertDateStr = format(alertDate, 'yyyy-MM-dd');

    // Query: expiry_date >= today AND expiry_date <= alertDate AND stock_packets > 0
    const { data: expiringItems, error: expiryError } = await supabase
      .from('medicines')
      .select('name, expiry_date')
      .gte('expiry_date', todayStr)
      .lte('expiry_date', alertDateStr)
      .gt('stock_packets', 0) // Exclude out of stock items from expiry warnings
      .order('expiry_date', { ascending: true })
      .limit(10);

    if (!expiryError && expiringItems) {
       expiringItems.forEach(item => {
         notifications.push({
           id: `expiry-${item.name}-${Date.now()}`,
           title: 'Expiring Soon',
           message: `${item.name} expires on ${item.expiry_date}`,
           type: 'warning'
         });
       });
    }

    return notifications;

  } catch (error) {
    // console.error('Error checking inventory notifications:', error);
    return [];
  }
}
