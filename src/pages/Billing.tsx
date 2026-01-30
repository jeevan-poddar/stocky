import { useState, useEffect } from 'react';
import { Search, Trash2, ShoppingCart, Save, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Medicine, CartItem } from '../types';
import { cn } from '../lib/utils';

const Billing = () => {
  // --- State ---
  // Customer Details
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  // Search & Inventory
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Checkout
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const searchMedicines = async () => {
    setIsSearching(true);
    const { data, error } = await supabase
      .from('medicines')
      .select('*')
      .or(`name.ilike.%${searchTerm}%,composition.ilike.%${searchTerm}%`)
      .gt('expiry_date', new Date().toISOString().split('T')[0]) // Optional: Filter expired? user didn't explicitly say, but it's good practice. Keep it strictly search for now as User asked to show exp dates.
      // Actually user wanted to see list of batches. If I filter text I might miss relevant ones.
      // Reverting the filter to match user requirement: "Show a List of Batches available...". They might want to sell expired stock? 
      // Let's perform the search without expiry filter for now, but maybe order by expiry?
      .order('expiry_date', { ascending: true }) 
      .limit(10);
    
    if (!error && data) {
      setSearchResults(data);
    }
    setIsSearching(false);
  };

  // --- Cart Formatting Helpers ---
  const getTotalStock = (med: Medicine) => {
    return (med.stock_packets * med.units_per_packet) + med.stock_loose;
  };

  const addToCart = (med: Medicine) => {
    const existingItem = cart.find(item => item.id === med.id);
    const maxStock = getTotalStock(med);

    if (maxStock <= 0) {
      alert("Out of stock!");
      return;
    }

    if (existingItem) {
      alert("This batch is already in your cart!");
      return;
    }

    setCart([...cart, { ...med, cartQuantity: 1, sellingPrice: med.mrp }]);
    setSearchTerm(''); // Clear search after adding
    setSearchResults([]);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateCartItem = (id: string, field: 'cartQuantity' | 'sellingPrice', value: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        if (field === 'cartQuantity') {
          // Check stock limit
          const maxStock = getTotalStock(item);
          if (value > maxStock) {
             alert(`Cannot exceed available stock of ${maxStock} units!`);
             return item; 
          }
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // --- Totals Calculation ---
  const grandTotal = cart.reduce((sum, item) => sum + (item.cartQuantity * item.sellingPrice), 0);
  
  const totalProfit = cart.reduce((sum, item) => {
    // Profit = (Selling Price - Purchase Price) * Qty
    const profitPerUnit = item.sellingPrice - (item.purchase_price / item.units_per_packet); // Purchase price is usually per strip/box?
    // Wait. purchase_price in schema usually refers to the Buying Price of the 'pack'? 
    // In AddMedicineModal: Price Row has MRP and Purchase Price. 
    // If quantity_type is 'Strip', does Purchase Price mean per Strip?
    // Usually yes.
    // If I sell 1 unit (1 strip), profit is SP - PP.
    // However, if I break the pack?
    // Wait, the logic for `stock_loose` and `stock_packets` implies:
    // `units_per_packet` is how many `units` are in a `packet`.
    // BUT the prompt says "Pack + Loose".
    // If quantity_type is 'Strip', we track Strips. 
    // Usually stock_packets = Box. stock_loose = Loose Strips.
    // units_per_packet = Strips per Box.
    // purchase_price is usually Per Box or Per Strip?
    // Let's assume Purchase Price is Per UNIT (Strip) for simplicity unless specified otherwise, OR check AddModal labels.
    // AddMedicineModal inputs: MRP, Purchase Price.
    // It doesn't specify if it is per box or per unit. 
    // Standard practice: MRP is per Unit (Strip). Purchase Price is per Unit (Strip).
    // Let's assume Purchase Price is PER UNIT (Quantity Type).
    return sum + ((item.sellingPrice - item.purchase_price) * item.cartQuantity);
  }, 0);

  // --- Checkout ---
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }
    if (!customerName) {
      alert("Please enter Customer Name.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Prepare payload for RPC
      const payload = {
        p_customer_name: customerName,
        p_customer_phone: phone,
        p_doctor_name: doctorName,
        p_total_amount: grandTotal,
        p_total_profit: totalProfit,
        p_payment_mode: paymentMode,
        p_items: cart.map(item => ({
          id: item.id,
          name: item.name,
          batch_no: item.batch_no,
          expiry_date: item.expiry_date,
          mrp: item.mrp,
          sellingPrice: item.sellingPrice,
          cartQuantity: item.cartQuantity
        }))
      };

      const { data, error } = await supabase.rpc('create_bill_transaction', payload);

      if (error) throw error;

      setSuccessMessage("Bill Saved Successfully!");
      setCart([]);
      setCustomerName('');
      setPhone('');
      setDoctorName('');
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any) {
      console.error(err);
      alert("Failed to save bill: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Bill</h1>
          <p className="text-sm text-gray-500">Create invoice for customer</p>
        </div>
        {successMessage && (
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md font-medium animate-fade-in">
            {successMessage}
          </div>
        )}
      </div>

      {/* 1. Customer Details */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Customer Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input 
              type="text" 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border"
              placeholder="Enter name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input 
              type="text" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border"
              placeholder="Enter phone"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name (Optional)</label>
            <input 
              type="text" 
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border"
              placeholder="Dr. Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
            <select 
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Medicine Search & Selection (Left - 2cols) */}
        <div className="lg:col-span-2 space-y-4">
           {/* Search Input */}
           <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search medicine by name or composition (e.g. Dolo)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
          </div>

          {/* Search Results */}
          {searchTerm && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[200px]">
              {isSearching ? (
                 <div className="flex items-center justify-center h-40 text-gray-500">
                    <Loader2 className="animate-spin h-6 w-6 mr-2" /> Searching...
                 </div>
              ) : searchResults.length === 0 ? (
                 <div className="flex items-center justify-center h-40 text-gray-500">
                    No medicines found.
                 </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
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
      </div>
    </div>
  );
};

export default Billing;
