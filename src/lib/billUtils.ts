import { supabase } from './supabase';
import { format, startOfDay } from 'date-fns';

export async function getNewInvoiceNumber(): Promise<string> {
  const today = new Date();
  const todayStr = format(today, 'yyyyMMdd');
  const timeStr = format(today, 'HHmm'); // e.g. 1430
  const startOfToday = startOfDay(today).toISOString();
  
  // Format: INV-YYYYMMDD-HHmm-SERIAL (e.g., INV-20231027-1430-001)
  
  try {
    // Query bills table to get the latest invoice_number created today
    const { data, error } = await supabase
      .from('bills')
      .select('invoice_number')
      .gte('created_at', startOfToday)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
        console.error('Error fetching last bill:', error);
        throw error;
    }

    let nextSerial = 1;

    if (data?.invoice_number) {
      // Extract the last part as serial
      const parts = data.invoice_number.split('-');
      // Expected: ['INV', 'YYYYMMDD', 'HHmm', 'SERIAL'] (length 4)
      // Or previous format: ['INV', 'YYYYMMDD', 'SERIAL'] (length 3)
      
      // We always take the last part
      if (parts.length >= 3) {
         const lastSerialStr = parts[parts.length - 1];
         const lastSerial = parseInt(lastSerialStr, 10);
         
         if (!isNaN(lastSerial)) {
           nextSerial = lastSerial + 1;
         }
      }
    }

    // Format new serial
    const serialStr = nextSerial.toString().padStart(3, '0');
    return `INV-${todayStr}-${timeStr}-${serialStr}`;

  } catch (error) {
    console.error('Error generating invoice number:', error);
    throw new Error('Failed to generate Invoice Number');
  }
}
