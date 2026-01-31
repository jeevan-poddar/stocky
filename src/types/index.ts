export interface Medicine {
  id: string;
  name: string;
  composition: string;
  batch_no: string;
  quantity_type: 'Strip' | 'Unit';
  units_per_packet: number;
  stock_packets: number;
  stock_loose: number;
  manufacture_date: string; // ISO date string YYYY-MM-DD
  expiry_date: string; // ISO date string YYYY-MM-DD
  mrp: number;
  purchase_price: number;
  location: string;
  purchased_from: string;
  company: string;
  created_at?: string;
}

export interface MedicineInsert extends Omit<Medicine, 'id' | 'created_at'> { }

// ... existing code ...
export interface CartItem extends Medicine {
  cartQuantity: number;
  sellingPrice: number;
}

export interface BillItem {
  id?: string;
  bill_id: string;
  medicine_name: string;
  quantity: number;
  selling_price: number;
  created_at?: string;
}

export interface Bill {
  id: string;
  customer_name: string;
  customer_phone?: string;
  doctor_name?: string;
  total_amount: number;
  payment_mode: string;
  status: string;
  created_at: string;
  invoice_number?: string;
  seller_dl_number?: string;
  bill_items?: BillItem[];
}

export interface Profile {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  dl_number: string;
  expiry_threshold_days: number;
  low_stock_threshold: number;
  created_at: string;
}

export interface Return {
  id: string;
  medicine_name: string;
  batch_no: string;
  quantity_returned_packets: number;
  quantity_returned_loose: number;
  reason: string;
  return_date: string;
}
