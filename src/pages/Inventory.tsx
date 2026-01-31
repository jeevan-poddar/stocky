import { useEffect, useState } from 'react';
import { Plus, Search, Eye, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Medicine } from '../types';
import AddMedicineModal from '../components/AddMedicineModal';
import ConfirmationModal from '../components/ConfirmationModal';
import SuccessModal from '../components/SuccessModal';
import { cn } from '../lib/utils';

const Inventory = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add/Edit Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);

  // Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Success Modal
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const [expiryThreshold, setExpiryThreshold] = useState(60);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
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
          .select('expiry_threshold_days, low_stock_threshold')
          .single()
      ]);

      if (medicinesData.error) throw medicinesData.error;
      
      setMedicines(medicinesData.data || []);

      if (profileData.data) {
        setExpiryThreshold(profileData.data.expiry_threshold_days || 60);
        setLowStockThreshold(profileData.data.low_stock_threshold || 10);
      }
    } catch (error) {
      // console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
        const { error } = await supabase.from('medicines').delete().eq('id', itemToDelete);
        if (error) {
           console.error('Error deleting medicine:', error); // Log for debugging
           // Optionally show error modal here
        } else {
          showSuccess('Deleted!', 'Medicine has been deleted successfully.');
          fetchMedicines();
        }
    } catch (error) {
        console.error(error);
    } finally {
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
    }
  };

  const showSuccess = (title: string, message: string) => {
    setSuccessModal({
      isOpen: true,
      title,
      message
    });
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
                  const isLowStock = med.stock_packets <= lowStockThreshold;
                  
                  return (
                    <tr 
                      key={med.id} 
                      className={cn(
                        "transition-colors cursor-pointer",
                        isLowStock ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-gray-50"
                      )}
                      onClick={() => handleView(med)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{med.name}</div>
                        <div className="text-xs text-gray-500">{med.composition}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{med.batch_no}</div>
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
                         {isLowStock && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              Low Stock
                            </span>
                         )}
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
                            handleDeleteClick(med.id);
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
          showSuccess(selectedMedicine ? 'Updated!' : 'Added!', selectedMedicine ? 'Medicine details updated successfully.' : 'New medicine added to inventory.');
          fetchMedicines();
        }}
        initialData={selectedMedicine}
        isViewMode={isViewMode}
      />

       {/* Delete Confirmation Modal */}
       <ConfirmationModal 
         isOpen={isDeleteModalOpen}
         onClose={() => setIsDeleteModalOpen(false)}
         onConfirm={confirmDelete}
         title="Delete Medicine?"
         message="Are you sure you want to delete this medicine? This action cannot be undone."
         confirmText="Delete"
         isDestructive={true}
       />
       
       {/* Success Modal */}
       <SuccessModal
         isOpen={successModal.isOpen}
         onClose={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
         title={successModal.title}
         message={successModal.message}
       />
    </div>
  );
};

export default Inventory;
