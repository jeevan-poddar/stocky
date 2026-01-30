import { useEffect, useState } from 'react';
import { Plus, Search, Eye, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Medicine } from '../types';
import AddMedicineModal from '../components/AddMedicineModal';
import { cn } from '../lib/utils';

const Inventory = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);

  const [expiryThreshold, setExpiryThreshold] = useState(60);
  const [hideOutOfStock, setHideOutOfStock] = useState(false);

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    setLoading(true);

    try {
      // Parallel fetch: medicines + profile settings
      const [medicinesData, profileData] = await Promise.all([
        supabase
          .from('medicines')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('profiles')
          .select('expiry_threshold_days')
          .single()
      ]);

      if (medicinesData.error) throw medicinesData.error;
      
      setMedicines(medicinesData.data || []);

      if (profileData.data) {
        setExpiryThreshold(profileData.data.expiry_threshold_days || 60);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;

    const { error } = await supabase.from('medicines').delete().eq('id', id);
    if (error) {
      console.error('Error deleting medicine:', error);
    } else {
      fetchMedicines();
    }
  };

  const handleAddNew = () => {
    setSelectedMedicine(null);
    setIsViewMode(false);
    setIsAddModalOpen(true);
  };

  const handleView = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setIsViewMode(true);
    setIsAddModalOpen(true);
  };

  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { color: 'text-red-600 bg-red-50', text: 'Expired' };
    if (diffDays <= expiryThreshold) return { color: 'text-orange-600 bg-orange-50', text: 'Expiring Soon' };
    return { color: 'text-green-600 bg-green-50', text: 'Valid' };
  };

  const filteredMedicines = medicines.filter(med => {
    const matchesSearch = med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    med.composition.toLowerCase().includes(searchTerm.toLowerCase());

    const hasStock = med.stock_packets > 0 || med.stock_loose > 0;

    if (hideOutOfStock) {
      return matchesSearch && hasStock;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">Manage your medicine stock</p>
        </div>
        <button 
          onClick={handleAddNew}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Medicine
        </button>
      </div>

      {/* Search Bar & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or composition..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input 
            type="checkbox"
            checked={hideOutOfStock}
            onChange={(e) => setHideOutOfStock(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Hide Out of Stock</span>
        </label>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Medicine Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch / HSN
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiry Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Level
                </th>
                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MRP
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    Loading inventory...
                  </td>
                </tr>
              ) : filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    No medicines found.
                  </td>
                </tr>
              ) : (
                filteredMedicines.map((med) => {
                  const expiryStatus = getExpiryStatus(med.expiry_date);
                  return (
                    <tr 
                      key={med.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleView(med)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{med.name}</div>
                        <div className="text-xs text-gray-500">{med.composition}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{med.batch_no}</div>
                        <div className="text-xs text-gray-500">{med.hsn_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full gap-1 items-center",
                          expiryStatus.color
                        )}>
                          {med.expiry_date}
                          {expiryStatus.text === 'Expiring Soon' && <AlertCircle className="h-3 w-3" />}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                         {med.stock_packets} {med.quantity_type === 'Strip' ? 'Boxes' : 'Units'} + {med.stock_loose} Loose
                      </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{med.mrp.toFixed(2)} / {med.quantity_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(med);
                          }}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(med.id);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddMedicineModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => {
          fetchMedicines();
        }}
        initialData={selectedMedicine}
        isViewMode={isViewMode}
      />
    </div>
  );
};

export default Inventory;
