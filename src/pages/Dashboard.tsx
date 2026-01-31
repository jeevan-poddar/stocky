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
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayBills: 0,
    lowStock: 0,
    expiringSoon: 0,
    expiryThreshold: 60,
    lowStockThreshold: 10
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
        .select('expiry_threshold_days, low_stock_threshold')
        .single();
      
      const threshold = profile?.expiry_threshold_days || 60;
      const stockThreshold = profile?.low_stock_threshold || 10;

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
          .select('*, bill_items(*)') // Also fetch items if needed, but select * is fine
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      // Process Sales Data
      const todayBills = salesData.data || [];
      const totalSales = todayBills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);

      // Process Low Stock & Expiring Data
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      const allMedicines = (medicinesData.data as Medicine[]) || [];
      
      // Low Stock: Count <= threshold AND Not Expired
      const lowStock = allMedicines.filter(m => 
        m.stock_packets <= stockThreshold && 
        new Date(m.expiry_date) >= todayDate
      );
      
      const expiryDateLimit = addDays(new Date(), threshold);
      
      // Expiring Soon: Expiring within threshold AND In Stock (> 0)
      const expiringSoon = allMedicines.filter(m => {
        const expDate = new Date(m.expiry_date);
        return expDate <= expiryDateLimit && 
               expDate >= todayDate && 
               m.stock_packets > 0;
      });

      setLowStockItems(lowStock);

      setStats({
        todaySales: totalSales,
        todayBills: todayBills.length,
        lowStock: lowStock.length,
        expiringSoon: expiringSoon.length,
        expiryThreshold: threshold,
        lowStockThreshold: stockThreshold
      });

      setRecentBills(recentBillsData.data || []);

    } catch (error) {
      // console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewBill = (billId: string) => {
    setSelectedBillId(billId);
    setIsBillModalOpen(true);
  };

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
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Overview of your pharmacy performance today
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-soft text-sm text-gray-600">
          <Calendar className="h-4 w-4 text-brand-primary-start" />
          <span className="font-medium">{format(new Date(), 'dd MMMM yyyy')}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="gradient" className="p-6 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-white/80 font-medium mb-1">Today's Sales</p>
            <h3 className="text-3xl font-bold text-white">₹{stats.todaySales.toLocaleString()}</h3>
            <p className="text-white/70 text-sm mt-1">Total revenue generated</p>
          </div>
          <div className="absolute right-0 top-0 p-6 text-white/20">
            <TrendingUp className="h-24 w-24 transform translate-x-4 -translate-y-4" />
          </div>
        </Card>

        <Card className="p-6 flex items-center justify-between">
          <div>
            <p className="text-gray-500 font-medium mb-1">Bills Created</p>
            <h3 className="text-2xl font-bold text-gray-800">{stats.todayBills}</h3>
            <p className="text-gray-400 text-xs mt-1">Total transactions today</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
            <ShoppingBag className="h-6 w-6" />
          </div>
        </Card>

        <Card 
          className="p-6 flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => window.location.href = '/returns'}
        >
          <div>
            <p className="text-gray-500 font-medium mb-1">Expiring Soon</p>
            <h3 className="text-2xl font-bold text-gray-800">{stats.expiringSoon}</h3>
            <p className="text-gray-400 text-xs mt-1">In next {stats.expiryThreshold} days</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
            <Calendar className="h-6 w-6" />
          </div>
        </Card>

        <Card 
          className="p-6 flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform"
          onClick={() => setIsLowStockModalOpen(true)}
        >
          <div>
            <p className="text-gray-500 font-medium mb-1">Low Stock</p>
            <h3 className="text-2xl font-bold text-gray-800">{stats.lowStock}</h3>
            <p className="text-gray-400 text-xs mt-1">Items &le; {stats.lowStockThreshold}</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </Card>
      </div>

      {/* Recent Sales Section */}
      <Card className="overflow-hidden p-0 border-none">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white">
          <h3 className="font-bold text-xl text-gray-800">Recent Sales</h3>
          <Link 
            to="/sales-history" 
            className="text-brand-primary-start hover:text-brand-primary-end font-medium flex items-center gap-1 transition-colors"
          >
            View All <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#FFFDFB] text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-8 py-4">Customer Name</th>
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4">Amount</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/50">
              {loading ? (
                <tr>
                   <td colSpan={5} className="px-8 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary-start"></div>
                      Loading data...
                    </div>
                  </td>
                </tr>
              ) : recentBills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-gray-500">
                    No recent sales found.
                  </td>
                </tr>
              ) : (
                recentBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-5 font-semibold text-gray-800">
                      {bill.customer_name}
                    </td>
                    <td className="px-8 py-5 text-gray-500">
                      {format(new Date(bill.created_at), 'dd MMM, HH:mm')}
                    </td>
                    <td className="px-8 py-5 font-bold text-gray-800">
                      ₹{bill.total_amount.toFixed(2)}
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        Completed
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <Button 
                        variant="secondary"
                        size="sm"
                        onClick={() => handleViewBill(bill.id)}
                        className="h-8 px-4 text-xs shadow-none hover:shadow-md"
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
