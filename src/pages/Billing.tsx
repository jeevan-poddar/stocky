import { useState, useEffect } from 'react';
import { Search, Trash2, ShoppingCart, Save, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Medicine, CartItem } from '../types';
import { cn } from '../lib/utils';
import { getNewInvoiceNumber } from '../lib/billUtils';
import SuccessModal from '../components/SuccessModal';
import { triggerLowStockAlert } from '../lib/notificationUtils';

const Billing = () => {
  // --- State ---
  // Customer Details
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [sellerDLNumber, setSellerDLNumber] = useState<string | null>(null);
  const [errors, setErrors] = useState<{customerName?: string, phone?: string}>({});

  // Search & Inventory
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Checkout
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [grandTotal, setGrandTotal] = useState(0);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  // Success Modal
  const [successModal, setSuccessModal] = useState<{isOpen: boolean, title: string, message: string}>({
      isOpen: false,
      title: '',
      message: ''
  });

  // --- Search Logic ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim()) {
        searchMedicines();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Fetch Seller Profile (DL Number)
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('dl_number, low_stock_threshold')
          .eq('id', user.id)
          .single();
        if (data) {
          if (data.dl_number) setSellerDLNumber(data.dl_number);
          if (data.low_stock_threshold) setLowStockThreshold(data.low_stock_threshold);
        }
      }
    };
    fetchProfile();
  }, []);

  // Update Grand Total whenever cart changes
  useEffect(() => {
    setGrandTotal(calculateTotal());
  }, [cart]);

  const searchMedicines = async () => {
    setIsSearching(true);
    const { data, error } = await supabase
      .from('medicines')
      .select('*')
      .or(`name.ilike.%${searchTerm}%,composition.ilike.%${searchTerm}%`)
      .gt('expiry_date', new Date().toISOString().split('T')[0]) 
      .limit(10);
      
    if (error) {
        // console.error(error);
    } else {
        setSearchResults(data || []);
    }
    setIsSearching(false);
  };

  // --- Cart Logic ---
  const addToCart = (medicine: Medicine) => {
    const existingItem = cart.find(item => item.id === medicine.id);
    
    // Check stock
    const currentQtyInCart = existingItem ? existingItem.cartQuantity : 0;
    
    if (currentQtyInCart + 1 > medicine.stock_packets) {
         setMessage({ type: 'error', text: `Insufficient stock for ${medicine.name}` });
         setTimeout(() => setMessage(null), 3000);
         return;
    }

    if (existingItem) {
      setCart(cart.map(item => 
        item.id === medicine.id 
          ? { ...item, cartQuantity: item.cartQuantity + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { ...medicine, cartQuantity: 1, sellingPrice: medicine.mrp }]); 
    }
    setSearchTerm(''); // Clear search
    setSearchResults([]); 
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateCartItem = (id: string, field: 'cartQuantity' | 'sellingPrice', value: number) => {
    if (value < 0) return;
    
    setCart(cart.map(item => {
        if (item.id === id) {
            return { ...item, [field]: value };
        }
        return item;
    }));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.sellingPrice * item.cartQuantity), 0);
  };

  // --- Submit Bill ---
  const handleSaveBill = async () => {
    // Validation
    const newErrors: {customerName?: string, phone?: string} = {};
    if (!customerName.trim()) newErrors.customerName = "Customer Name is required";
    else if (!/^[A-Za-z\s]+$/.test(customerName)) newErrors.customerName = "Name must contain letters only";

    if (!phone.trim()) newErrors.phone = "Phone Number is required";
    
    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
    }

    if (cart.length === 0) {
      setMessage({ type: 'error', text: "Cart is empty!" });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const invoiceNumber = await getNewInvoiceNumber();
      const totalProfit = cart.reduce((acc, item) => acc + ((item.sellingPrice - item.purchase_price) * item.cartQuantity), 0);

      const { error } = await supabase.rpc('create_bill_transaction', {
        p_customer_name: customerName,
        p_customer_phone: phone,
        p_doctor_name: doctorName,
        p_total_amount: calculateTotal(),
        p_total_profit: totalProfit,
        p_payment_mode: paymentMode,
        p_items: cart,
        p_invoice_number: invoiceNumber,
        p_seller_dl_number: sellerDLNumber
      });

      if (error) throw error;

      // Success
      setSuccessModal({
          isOpen: true,
          title: 'Bill Saved!',
          message: `Invoice #${invoiceNumber} generated successfully.`
      });

      // --- Instant Inventory Alert (Billing) ---
      cart.forEach(item => {
         // Logic: Estimate new box count
         const unitsPerBox = item.units_per_packet && item.units_per_packet > 0 ? item.units_per_packet : 1;
         const currentTotalUnits = (item.stock_packets * unitsPerBox) + item.stock_loose;
         const soldUnits = item.cartQuantity; // Assuming cart is unit-based
         const remainingUnits = currentTotalUnits - soldUnits;
         const remainingBoxes = Math.floor(remainingUnits / unitsPerBox);

         if (remainingBoxes <= lowStockThreshold) {
             triggerLowStockAlert(item.name, remainingBoxes);
         }
      });

      // Clear all
      setCart([]);
      setCustomerName('');
      setPhone('');
      setDoctorName('');
      setErrors({});
      
    } catch (err: any) {
      // console.error(err);
      setMessage({ type: 'error', text: "Failed to save bill: " + err.message });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = () => {
      handleSaveBill();
  };

  const getTotalStock = (med: Medicine) => {
      // Simplified total units calculation
      return med.stock_packets; 
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-6rem)]">
      {/* Left Column: Product Search & Cart */}
      <div className="lg:col-span-2 flex flex-col gap-6 h-full">
        {/* Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
           {/* Customer Info Section (Moved inside or kept separate? Layout implies Search is top) */}
           {/* Let's keep search focused here */}
          <div className="flex flex-col gap-4 mb-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <input 
                      type="text" 
                      placeholder="Customer Name" 
                      value={customerName}
                      onChange={(e) => {
                          setCustomerName(e.target.value);
                          if(errors.customerName) setErrors(prev => ({...prev, customerName: ''}));
                      }}
                      className={cn("w-full p-2 border rounded", errors.customerName ? "border-red-500" : "border-gray-200")}
                    />
                    {errors.customerName && <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>}
                  </div>
                  <div>
                    <input 
                      type="text" 
                      placeholder="Phone Number" 
                      value={phone}
                      onChange={(e) => {
                          setPhone(e.target.value);
                          if(errors.phone) setErrors(prev => ({...prev, phone: ''}));
                      }}
                      className={cn("w-full p-2 border rounded", errors.phone ? "border-red-500" : "border-gray-200")}
                    />
                     {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <input 
                      type="text" 
                      placeholder="Doctor Name (Optional)" 
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded"
                    />
                   <select 
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded"
                   >
                       <option value="Cash">Cash</option>
                       <option value="UPI">UPI</option>
                       <option value="Card">Card</option>
                   </select>
               </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search medicines..."
              className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
                <div className="overflow-x-auto mt-4 border rounded-lg max-h-60 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {searchResults.map((med) => {
                         const totalStock = getTotalStock(med);
                         const isExpired = new Date(med.expiry_date) < new Date();
                         
                         return (
                          <tr key={med.id} className={cn("hover:bg-gray-50", isExpired && "bg-red-50")}>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{med.name}</div>
                              <div className="text-xs text-gray-500">{med.composition}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{med.batch_no}</td>
                            <td className="px-6 py-4">
                               <span className={cn(
                                 "text-sm", 
                                 isExpired ? "text-red-600 font-medium" : "text-gray-900"
                               )}>
                                 {med.expiry_date}
                               </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {med.stock_packets} Box + {med.stock_loose} Loose
                              <div className="text-xs text-gray-400">Total: {totalStock} units</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">₹{med.mrp}</td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => addToCart(med)}
                                disabled={totalStock <= 0 || isExpired}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add
                              </button>
                            </td>
                          </tr>
                         );
                      })}
                    </tbody>
                  </table>
                </div>
           )}
        </div>

        {/* Message Banner */}
        {message && (
             <div className={cn("p-4 rounded-lg", message.type === 'error' ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")}>
                 {message.text}
             </div>
        )}

      </div>

      {/* 3. The Cart (Right - 1col) */}
      <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-140px)]">
            <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl flex justify-between items-center">
               <h2 className="font-semibold text-gray-800 flex items-center">
                 <ShoppingCart className="h-5 w-5 mr-2" /> Current Bill
               </h2>
               <span className="text-sm text-gray-500">{cart.length} Items</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <ShoppingCart className="h-12 w-12 mb-2 opacity-20" />
                  <p>Cart is empty</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex flex-col p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                    <div className="flex justify-between items-start mb-2">
                       <div>
                         <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                         <p className="text-xs text-gray-500">Batch: {item.batch_no} | Exp: {item.expiry_date}</p>
                       </div>
                       <button 
                         onClick={() => removeFromCart(item.id)}
                         className="text-red-400 hover:text-red-600 p-1"
                       >
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 items-end">
                       <div>
                         <label className="text-xs text-gray-500 mb-1 block">Qty (Units)</label>
                         <input 
                           type="number" 
                           min="1"
                           value={item.cartQuantity}
                           onChange={(e) => updateCartItem(item.id, 'cartQuantity', parseInt(e.target.value) || 0)}
                           className="w-full text-sm border-gray-300 rounded-md py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                         />
                       </div>
                       <div>
                         <label className="text-xs text-gray-500 mb-1 block">Price/Unit</label>
                         <input 
                           type="number" 
                           step="0.01"
                           value={item.sellingPrice}
                           onChange={(e) => updateCartItem(item.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                           className="w-full text-sm border-gray-300 rounded-md py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                         />
                       </div>
                    </div>
                    <div className="mt-2 text-right text-sm font-semibold text-gray-900">
                      ₹{(item.cartQuantity * item.sellingPrice).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Totals */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl space-y-4">
               <div className="flex justify-between items-center">
                 <span className="text-gray-600">Total Items</span>
                 <span className="font-medium">{cart.length}</span>
               </div>
               <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                 <span className="text-lg font-bold text-gray-800">Grand Total</span>
                 <span className="text-2xl font-bold text-blue-600">₹{grandTotal.toFixed(2)}</span>
               </div>
               
               <button 
                 onClick={handleCheckout}
                 disabled={cart.length === 0 || isSubmitting}
                 className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
               >
                 {isSubmitting ? (
                   <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Processing...
                   </>
                 ) : (
                   <>
                    <Save className="mr-2 h-5 w-5" />
                    Complete Bill
                   </>
                 )}
               </button>
            </div>
          </div>
      </div>
       <SuccessModal
         isOpen={successModal.isOpen}
         onClose={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
         title={successModal.title}
         message={successModal.message}
       />
    </div>
  );
};

export default Billing;
