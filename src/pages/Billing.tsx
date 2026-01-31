import { useState, useEffect } from 'react';
import { Search, Trash2, ShoppingCart, Save, Plus, Loader2, User, Phone, Stethoscope, CreditCard, AlertCircle, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Medicine, CartItem } from '../types';
import { cn } from '../lib/utils';
import { getNewInvoiceNumber } from '../lib/billUtils';
import SuccessModal from '../components/SuccessModal';
import { triggerLowStockAlert } from '../lib/notificationUtils';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

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
        {/* Customer & Search Card */}
        <Card className="p-6 space-y-6">
           {/* Customer Info Section */}
          <div className="space-y-4">
               <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                 <User className="h-5 w-5 text-brand-primary-start" />
                 Customer Details
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input 
                      icon={User}
                      placeholder="Customer Name" 
                      value={customerName}
                      onChange={(e) => {
                          setCustomerName(e.target.value);
                          if(errors.customerName) setErrors(prev => ({...prev, customerName: ''}));
                      }}
                      error={errors.customerName}
                    />
                  </div>
                  <div>
                    <Input 
                      icon={Phone}
                      placeholder="Phone Number" 
                      value={phone}
                      onChange={(e) => {
                          setPhone(e.target.value);
                          if(errors.phone) setErrors(prev => ({...prev, phone: ''}));
                      }}
                       error={errors.phone}
                    />
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <Input 
                      icon={Stethoscope}
                      placeholder="Doctor Name (Optional)" 
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                    />
                   <div>
                    <Select 
                        icon={CreditCard}
                        options={[
                            { value: 'Cash', label: 'Cash' },
                            { value: 'UPI', label: 'UPI' },
                            { value: 'Card', label: 'Card' }
                        ]}
                        value={paymentMode}
                        onChange={setPaymentMode}
                    />
                   </div>
               </div>
          </div>

          <div className="relative pt-4 border-t border-gray-100">
             <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                 <Search className="h-5 w-5 text-brand-primary-start" />
                 Search Medicine
             </h3>
             <Input
               icon={Search}
               placeholder="Search medicines by name or composition (e.g. Dolo)..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="bg-white border-2 border-brand-bg focus:border-brand-primary-start/30"
             />
             {isSearching && (
               <Loader2 className="absolute right-4 top-[4.5rem] h-5 w-5 animate-spin text-brand-primary-start" />
             )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
                <div className="overflow-x-auto mt-2 border border-brand-primary-start/20 rounded-2xl max-h-60 overflow-y-auto shadow-lg shadow-brand-primary-start/5">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-[#FFF5F0] sticky top-0 backdrop-blur-sm z-10">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-brand-primary-start uppercase tracking-wider">Medicine</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-brand-primary-start uppercase tracking-wider">Batch</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-brand-primary-start uppercase tracking-wider">Expiry</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-brand-primary-start uppercase tracking-wider">Stock</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-brand-primary-start uppercase tracking-wider">MRP</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                      {searchResults.map((med) => {
                         const totalStock = getTotalStock(med);
                         const isExpired = new Date(med.expiry_date) < new Date();
                         
                         return (
                          <tr key={med.id} className={cn("hover:bg-brand-bg transition-colors", isExpired && "bg-red-50 hover:bg-red-100")}>
                            <td className="px-6 py-4">
                              <div className="text-sm font-bold text-gray-800">{med.name}</div>
                              <div className="text-xs text-gray-500">{med.composition}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{med.batch_no}</td>
                            <td className="px-6 py-4">
                               <span className={cn(
                                 "text-sm", 
                                 isExpired ? "text-red-600 font-bold flex items-center gap-1" : "text-gray-900"
                               )}>
                                 {med.expiry_date}
                                 {isExpired && <AlertCircle className="h-3 w-3" />}
                               </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {med.stock_packets} Box + {med.stock_loose} Loose
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">₹{med.mrp}</td>
                            <td className="px-6 py-4 text-right">
                              <Button 
                                size="sm"
                                onClick={() => addToCart(med)}
                                disabled={totalStock <= 0 || isExpired}
                                className="h-8 rounded-full px-4"
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add
                              </Button>
                            </td>
                          </tr>
                         );
                      })}
                    </tbody>
                  </table>
                </div>
           )}
           
           {/* Message Banner */}
            {message && (
                 <div className={cn("p-4 rounded-xl flex items-center gap-3", message.type === 'error' ? "bg-red-50 text-red-700 border border-red-100" : "bg-green-50 text-green-700 border border-green-100")}>
                     <div className={cn("h-2 w-2 rounded-full", message.type === 'error' ? "bg-red-500" : "bg-green-500")} />
                     {message.text}
                 </div>
            )}
        </Card>

      </div>

      {/* 3. The Cart (Right - 1col) */}
      <div className="space-y-4">
          <Card className="flex flex-col h-[calc(100vh-140px)] p-0 overflow-hidden border-none shadow-soft bg-white ring-1 ring-black/5">
            {/* Receipt Header Idea */}
            <div className="relative p-5 bg-[#FFF9F5] border-b border-dashed border-brand-primary-start/30 flex justify-between items-center z-10">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary-start to-brand-primary-end"></div>
               <h2 className="font-bold text-gray-800 flex items-center text-lg">
                 <Receipt className="h-5 w-5 mr-2 text-brand-primary-start" /> Current Bill
               </h2>
               <span className="text-xs font-bold bg-white text-brand-primary-start px-3 py-1 rounded-full shadow-sm border border-brand-primary-start/10">{cart.length} Items</span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8F9FB]">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <div className="bg-white p-6 rounded-full mb-4 shadow-sm border border-gray-100">
                     <ShoppingCart className="h-8 w-8 text-gray-300" />
                  </div>
                  <p className="font-medium text-gray-500">Cart is empty</p>
                  <p className="text-sm opacity-60 mt-1">Ready to create invoice</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="relative flex flex-col p-4 bg-white rounded-2xl shadow-sm border border-gray-100 group">
                    <div className="flex justify-between items-start mb-3">
                       <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-xl bg-brand-primary-start/10 text-brand-primary-start flex items-center justify-center font-bold">
                            {item.name.charAt(0)}
                         </div>
                         <div>
                           <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{item.name}</h4>
                           <p className="text-[10px] text-gray-500 uppercase tracking-wide">Batch: {item.batch_no}</p>
                         </div>
                       </div>
                       <button 
                         onClick={() => removeFromCart(item.id)}
                         className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                       >
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 items-end bg-gray-50 p-2 rounded-xl">
                       <div className="relative">
                         <label className="text-[9px] uppercase font-bold text-gray-400 mb-1 block pl-1">Quantity</label>
                         <input 
                           type="number" 
                           min="1"
                           value={item.cartQuantity}
                           onChange={(e) => updateCartItem(item.id, 'cartQuantity', parseInt(e.target.value) || 0)}
                           className="w-full text-sm font-bold bg-white border border-gray-200 rounded-lg py-1.5 px-3 focus:ring-2 focus:ring-brand-primary-start/20 focus:border-brand-primary-start/50 outline-none transition-all"
                         />
                       </div>
                       <div className="relative">
                         <label className="text-[9px] uppercase font-bold text-gray-400 mb-1 block pl-1">Rate (₹)</label>
                         <input 
                           type="number" 
                           step="0.01"
                           value={item.sellingPrice}
                           onChange={(e) => updateCartItem(item.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                           className="w-full text-sm font-bold bg-white border border-gray-200 rounded-lg py-1.5 px-3 focus:ring-2 focus:ring-brand-primary-start/20 focus:border-brand-primary-start/50 outline-none transition-all"
                         />
                       </div>
                    </div>
                    
                    <div className="mt-3 flex justify-between items-center px-1 border-t border-dashed border-gray-100 pt-2">
                      <span className="text-xs text-gray-500">Subtotal</span>
                      <span className="text-sm font-black text-gray-800">
                        ₹{(item.cartQuantity * item.sellingPrice).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Totals */}
            <div className="relative p-6 bg-white shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-20">
               {/* Decorative serrated edge top */}
               <div className="absolute top-0 left-0 right-0 h-4 -mt-4 overflow-hidden pointer-events-none">
                 {/* CSS Trick for serrated edge if possible, or just shadow */}
                 <div className="h-4 w-full bg-gradient-to-t from-black/5 to-transparent"></div>
               </div>

               <div className="space-y-3 mb-6">
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-500 font-medium">Items</span>
                   <span className="font-bold text-gray-800">{cart.length}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-500 font-medium">Subtotal</span>
                   <span className="font-bold text-gray-800">₹{grandTotal.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between items-center pt-4 border-t-2 border-dashed border-gray-100">
                   <span className="text-lg font-bold text-gray-800">Total</span>
                   <span className="text-3xl font-black text-brand-primary-start">
                     ₹{grandTotal.toFixed(2)}
                   </span>
                 </div>
               </div>
               
               <Button 
                 onClick={handleCheckout}
                 disabled={cart.length === 0 || isSubmitting}
                 className="w-full h-14 text-base font-bold shadow-xl shadow-brand-primary-start/30 hover:shadow-brand-primary-start/40 hover:translate-y-[-2px] transition-all"
               >
                 {isSubmitting ? (
                   <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Processing...
                   </>
                 ) : (
                   <>
                    <Save className="mr-2 h-5 w-5" />
                    Complete Transaction
                   </>
                 )}
               </Button>
            </div>
          </Card>
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
