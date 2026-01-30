import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  ShoppingBag, 
  AlertTriangle, 
  ArrowUpRight,
  Calendar
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { type Bill, type Medicine } from '../types';
import BillDetailsModal from '../components/BillDetailsModal';
import LowStockModal from '../components/LowStockModal';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayBills: 0,
    lowStock: 0,
    expiringSoon: 0,
    expiryThreshold: 60
  });
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [lowStockItems, setLowStockItems] = useState<Medicine[]>([]);
  
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 0. Fetch Profile for Threshold
      const { data: profile } = await supabase
        .from('profiles')
        .select('expiry_threshold_days')
        .single();
      
      const threshold = profile?.expiry_threshold_days || 60;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Parallel data fetching
      const [salesData, medicinesData, recentBillsData] = await Promise.all([
        // 1. Fetch today's bills for sales total and count
        supabase
          .from('bills')
          .select('total_amount')
          .gte('created_at', todayISO),
        
        // 2. Fetch all medicines to calculate low stock and expiring soon
        supabase
          .from('medicines')
          .select('*'),

        // 3. Fetch recent 5 bills
        supabase
          .from('bills')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      // Process Sales Data
      const todayBills = salesData.data || [];
      const totalSales = todayBills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);

      // Process Low Stock & Expiring Data
      const allMedicines = (medicinesData.data as Medicine[]) || [];
      const lowStock = allMedicines.filter(m => m.stock_packets < 2);
      
      const expiryDateLimit = addDays(new Date(), threshold);
      const expiringSoon = allMedicines.filter(m => new Date(m.expiry_date) <= expiryDateLimit);

      setLowStockItems(lowStock);

      setStats({
        todaySales: totalSales,
        todayBills: todayBills.length,
        lowStock: lowStock.length,
        expiringSoon: expiringSoon.length,
        expiryThreshold: threshold
      });

      setRecentBills(recentBillsData.data || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewBill = (billId: string) => {
    setSelectedBillId(billId);
    setIsBillModalOpen(true);
  };

  const StatCard = ({ title, value, subtext, icon: Icon, colorClass, bgClass, onClick, cursorClass }: any) => (
    <div 
      onClick={onClick}
      className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between ${cursorClass || ''} transition-shadow hover:shadow-md`}
    >
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg ${bgClass}`}>
        <Icon className={`h-6 w-6 ${colorClass}`} />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <BillDetailsModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        billId={selectedBillId}
      />
      
      <LowStockModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        lowStockItems={lowStockItems}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Overview of your pharmacy performance today
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 shadow-sm">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(), 'dd MMMM yyyy')}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Sales"
          value={`₹${stats.todaySales.toLocaleString()}`}
          subtext="Total revenue generated today"
          icon={TrendingUp}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
        />
        <StatCard
          title="Bills Created"
          value={stats.todayBills}
          subtext="Total transactions today"
          icon={ShoppingBag}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
        />
        <StatCard
          title="Expiring Soon"
          value={stats.expiringSoon}
          subtext={`Medicines expiring in ${stats.expiryThreshold} days`} 
          icon={Calendar}
          colorClass="text-red-600"
          bgClass="bg-red-50"
          onClick={() => window.location.href = '/returns'}
          cursorClass="cursor-pointer"
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStock}
          subtext="Medicines with packets < 2"
          icon={AlertTriangle}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
          onClick={() => setIsLowStockModalOpen(true)}
          cursorClass="cursor-pointer"
        />
      </div>

      {/* Recent Sales Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Sales</h3>
          <Link 
            to="/sales-history" 
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View All <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-3">Customer Name</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                   <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      Loading data...
                    </div>
                  </td>
                </tr>
              ) : recentBills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No recent sales found.
                  </td>
                </tr>
              ) : (
                recentBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {bill.customer_name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {format(new Date(bill.created_at), 'dd MMM, HH:mm')}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      ₹{bill.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
                        Completed
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleViewBill(bill.id)}
                        className="inline-flex items-center justify-center px-3 py-1.5 border border-gray-200 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
