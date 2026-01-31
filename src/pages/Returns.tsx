import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  History, 
  ArrowRightLeft,
  X
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { type Medicine, type Return } from '../types';

const Returns = () => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'history'>('alerts');
  const [expiringMedicines, setExpiringMedicines] = useState<Medicine[]>([]);
  const [returnHistory, setReturnHistory] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [returnPackets, setReturnPackets] = useState<string>('');
  const [returnLoose, setReturnLoose] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('Expired');

  const [thresholdDays, setThresholdDays] = useState(60);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'alerts') {
      fetchExpiringMedicines();
    } else {
      fetchReturnHistory();
    }
  }, [activeTab]);

  const fetchExpiringMedicines = async () => {
    setLoading(true);
    try {
      // 1. Fetch user preference
      const { data: profile } = await supabase
        .from('profiles')
        .select('expiry_threshold_days')
        .single();
      
      const threshold = profile?.expiry_threshold_days || 60;
      setThresholdDays(threshold);

      // Get date 'threshold' days from now
      const expiryDateLimit = addDays(new Date(), threshold).toISOString();

      // Fetch medicines expiring soon
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .lte('expiry_date', expiryDateLimit)
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      
      // Filter out items with 0 stock on client side to show items that actually have stock to return
      const stockItems = (data || []).filter(m => m.stock_packets > 0 || m.stock_loose > 0);
      setExpiringMedicines(stockItems);
    } catch (error) {
      // console.error('Error fetching expiring medicines:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReturnHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('returns')
        .select('*')
        .order('return_date', { ascending: false });

      if (error) throw error;
      setReturnHistory(data || []);
    } catch (error) {
      // console.error('Error fetching return history:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReturnModal = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setReturnPackets('');
    setReturnLoose('');
    setReturnReason('Expired');
    setModalError(null);
    setIsReturnModalOpen(true);
  };

    const handleReturnSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMedicine) return;

        const packets = parseInt(returnPackets || '0');
        const loose = parseInt(returnLoose || '0');

        if (packets === 0 && loose === 0) {
            setModalError('Please enter a quantity to return.');
            return;
        }

        if (packets > selectedMedicine.stock_packets || loose > selectedMedicine.stock_loose) {
            setModalError('Cannot return more than current stock.');
            return;
        }

        try {
            // 0. GET CURRENT USER (Crucial Step!)
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setModalError("You must be logged in to process returns.");
                return;
            }

            // 1. Insert into returns table (With user_id)
            const { error: insertError } = await supabase
                .from('returns')
                .insert({
                    user_id: user.id, // <--- ADD THIS LINE
                    medicine_name: selectedMedicine.name,
                    batch_no: selectedMedicine.batch_no,
                    quantity_returned_packets: packets,
                    quantity_returned_loose: loose,
                    reason: returnReason,
                    return_date: new Date().toISOString()
                });

            if (insertError) throw insertError;

            // 2. Update medicines table
            const newPackets = selectedMedicine.stock_packets - packets;
            const newLoose = selectedMedicine.stock_loose - loose;

            const { error: updateError } = await supabase
                .from('medicines')
                .update({
                    stock_packets: newPackets,
                    stock_loose: newLoose
                })
                .eq('id', selectedMedicine.id);

            if (updateError) throw updateError;

            // 3. Update local state
            setIsReturnModalOpen(false);
            fetchExpiringMedicines();
            setMessage({ type: 'success', text: 'Return processed successfully' });
            setTimeout(() => setMessage(null), 3000);

        } catch (error: any) {
            // console.error('Error processing return:', error.message);
            setModalError('Failed to process return: ' + error.message);
        }
    };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Returns Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage expired stock and view return logs</p>
        </div>
        
        {/* Tabs */}
        <div className="bg-gray-100 p-1 rounded-lg flex items-center">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'alerts' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Expiring in {thresholdDays} Days
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'history' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="h-4 w-4" />
            Return History
          </button>
        </div>
      </div>

       {message && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="hover:opacity-75"><X className="h-4 w-4" /></button>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Medicine Name</th>
                  <th className="px-6 py-4">Batch No</th>
                  <th className="px-6 py-4">Expiry Date</th>
                  <th className="px-6 py-4">Current Stock</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Checking expiry dates...
                      </div>
                    </td>
                  </tr>
                ) : expiringMedicines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No medicines expiring within {thresholdDays} days.
                    </td>
                  </tr>
                ) : (
                  expiringMedicines.map((med) => (
                    <tr key={med.id} className="hover:bg-red-50/10 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {med.name}
                        <span className="block text-xs text-gray-400 font-normal mt-0.5">
                          {med.composition}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-600">
                        {med.batch_no}
                      </td>
                      <td className="px-6 py-4 font-medium text-red-600">
                        {format(new Date(med.expiry_date), 'dd MMM yyyy')}
                        <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          {/* Alert logic could go here */}
                          Expires soon
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {med.stock_packets} Packs + {med.stock_loose} Loose
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openReturnModal(med)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                          Return Stock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Medicine Name</th>
                  <th className="px-6 py-4">Batch</th>
                  <th className="px-6 py-4">Quantity Returned</th>
                  <th className="px-6 py-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Loading logs...
                      </div>
                    </td>
                  </tr>
                ) : returnHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No return history found.
                    </td>
                  </tr>
                ) : (
                  returnHistory.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-gray-600">
                        {format(new Date(log.return_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {log.medicine_name}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-500">
                        {log.batch_no}
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {log.quantity_returned_packets} Packs + {log.quantity_returned_loose} Loose
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {log.reason}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isReturnModalOpen && selectedMedicine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-semibold text-gray-900">Return Stock</h3>
              <button 
                onClick={() => setIsReturnModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md mb-2">
                  {modalError}
                </div>
              )}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                 <p className="text-sm text-blue-800 font-medium">Returning: {selectedMedicine.name}</p>
                 <p className="text-xs text-blue-600 mt-1">Batch: {selectedMedicine.batch_no} • Expires: {format(new Date(selectedMedicine.expiry_date), 'dd MMM yyyy')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Packets
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={selectedMedicine.stock_packets}
                    value={returnPackets}
                    onChange={(e) => setReturnPackets(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder={`Max: ${selectedMedicine.stock_packets}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loose Units
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={selectedMedicine.stock_loose}
                    value={returnLoose}
                    onChange={(e) => setReturnLoose(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder={`Max: ${selectedMedicine.stock_loose}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                >
                  <option value="Expired">Expired</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Recalled">Recalled</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  Confirm Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;
