import { useEffect, useState } from 'react';
import { X, Calendar, User, Phone, Stethoscope, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { type Bill, type BillItem } from '../types';

interface BillDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  billId: string | null;
}

const BillDetailsModal = ({ isOpen, onClose, billId }: BillDetailsModalProps) => {
  const [bill, setBill] = useState<Bill | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBillDetails = async () => {
      if (!billId || !isOpen) return;

      setLoading(true);
      try {
        // Fetch bill details
        const { data: billData, error: billError } = await supabase
          .from('bills')
          .select('*')
          .eq('id', billId)
          .single();

        if (billError) throw billError;
        setBill(billData);

        // Fetch bill items
        const { data: itemsData, error: itemsError } = await supabase
          .from('bill_items')
          .select('*')
          .eq('bill_id', billId);

        if (itemsError) throw itemsError;
        setItems(itemsData || []);
      } catch (error) {
        // console.error('Error fetching bill details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBillDetails();
  }, [billId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bill Details</h2>
              <div className="flex gap-4 items-center">
                 {bill && <p className="text-sm text-gray-500 font-mono">#{bill.invoice_number || bill.id.slice(0, 8)}</p>}
                 {bill?.seller_dl_number && (
                   <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                     DL No: {bill.seller_dl_number}
                   </span>
                 )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : bill ? (
            <div className="space-y-8">
              {/* Meta Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">Customer</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{bill.customer_name}</p>
                    {bill.customer_phone && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <Phone className="h-3 w-3" />
                        <span>{bill.customer_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">Date & Time</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {format(new Date(bill.created_at), 'dd MMM yyyy')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(bill.created_at), 'hh:mm a')}
                    </p>
                  </div>
                </div>

                {bill.doctor_name && (
                  <div className="col-span-1 md:col-span-2 space-y-2 pt-2 border-t border-gray-200/50">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Stethoscope className="h-4 w-4" />
                      <span className="text-sm font-medium">Doctor</span>
                    </div>
                    <p className="font-medium text-gray-900">{bill.doctor_name}</p>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Items Purchased</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">Medicine Name</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Price/Unit</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-900">{item.medicine_name}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-600">₹{item.selling_price}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            ₹{(item.quantity * item.selling_price).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-900">Grand Total</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600 text-lg">
                          ₹{bill.total_amount.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Bill not found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillDetailsModal;
