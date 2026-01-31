import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Package, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Medicine } from '../types';
import AddMedicineModal from '../components/AddMedicineModal';
import ConfirmationModal from '../components/ConfirmationModal';
import SuccessModal from '../components/SuccessModal';
import { cn } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

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

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

    if (diffDays < 0) return { color: 'text-red-600 bg-red-50 ring-red-500/10', text: 'Expired', badgeColor: 'bg-red-100' };
    if (diffDays <= expiryThreshold) return { color: 'text-orange-600 bg-orange-50 ring-orange-500/10', text: 'Expiring Soon', badgeColor: 'bg-orange-100' };
    return { color: 'text-green-600 bg-green-50 ring-green-500/10', text: 'Valid', badgeColor: 'bg-green-100' };
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
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Inventory</h1>
          <p className="text-gray-500 mt-1">Manage your medicine stock</p>
        </div>
        <Button onClick={handleAddNew} className="hidden sm:flex">
          <Plus className="h-5 w-5 mr-2" />
          Add Medicine
        </Button>
      </div>

      {/* Search Bar & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="w-full sm:flex-1 sm:max-w-md">
          <Input 
            icon={Search}
            placeholder="Search by name or composition..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white"
          />
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-100">
          <input 
            type="checkbox"
            checked={hideOutOfStock}
            onChange={(e) => setHideOutOfStock(e.target.checked)}
            className="w-4 h-4 text-brand-primary-start rounded border-gray-300 focus:ring-brand-primary-start"
          />
          <span className="text-sm font-medium text-gray-700">Hide Out of Stock</span>
        </label>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary-start mx-auto mb-4"></div>
          <p className="text-gray-500">Loading inventory...</p>
        </div>
      ) : filteredMedicines.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-dashed border-gray-200">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No medicines found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMedicines.map((med) => {
            const expiryStatus = getExpiryStatus(med.expiry_date);
            const isLowStock = med.stock_packets <= lowStockThreshold;
            
            return (
              <Card 
                key={med.id} 
                className={cn(
                  "p-5 relative group cursor-pointer hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-brand-primary-start/10",
                  isLowStock && "ring-2 ring-amber-100 bg-amber-50/30"
                )}
                onClick={() => handleView(med)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-brand-primary-start/10 text-brand-primary-start flex items-center justify-center font-bold text-xl">
                      {med.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 line-clamp-1" title={med.name}>{med.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1" title={med.composition}>{med.composition}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                     {/* Actions (visible on hover or always on mobile) */}
                     <button 
                        onClick={(e) => handleDeleteClick(med.id, e)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm bg-brand-bg/50 p-3 rounded-xl">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-brand-primary-start" />
                      Stock
                    </span>
                    <span className={cn("font-bold", isLowStock ? "text-amber-600" : "text-gray-800")}>
                      {med.stock_packets} <span className="text-xs font-normal text-gray-500">Box</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm bg-brand-bg/50 p-3 rounded-xl">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-brand-primary-start" />
                      Expiry
                    </span>
                    <span className={cn("font-medium text-xs px-2 py-0.5 rounded-full", expiryStatus.badgeColor, expiryStatus.color.split(' ')[0])}>
                      {med.expiry_date}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                   <div>
                     <p className="text-xs text-gray-400">MRP</p>
                     <p className="font-bold text-gray-800">₹{med.mrp.toFixed(2)}</p>
                   </div>
                   <Button size="sm" variant="ghost" className="text-brand-primary-start bg-brand-primary-start/5 hover:bg-brand-primary-start/10 h-8 px-4 text-xs rounded-lg">
                      View
                   </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Add Button (Mobile) */}
      <div className="fixed bottom-6 inset-x-0 flex justify-center sm:hidden z-30 pointer-events-none">
        <Button 
          onClick={handleAddNew} 
          className="shadow-xl px-8 pointer-events-auto"
          size="lg"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add New Medicine
        </Button>
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
        lowStockThreshold={lowStockThreshold}
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
