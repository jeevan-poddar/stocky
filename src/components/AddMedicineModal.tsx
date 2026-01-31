import { useState, useEffect } from 'react';
import { X, Loader2, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { MedicineInsert, Medicine } from '../types';

interface AddMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Medicine | null;
  isViewMode?: boolean;
}

const AddMedicineModal: React.FC<AddMedicineModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialData,
  isViewMode = false
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize isEditing based on whether we are viewing an existing item or adding a new one
  // If we are validating data (isViewMode=true), we start in non-edit mode (false)
  // If we are adding new (initialData=null), we start in edit mode (true)
  const [isEditing, setIsEditing] = useState(!isViewMode);

  const initialFormData: MedicineInsert = {
    name: '',
    composition: '',
    batch_no: '',
    quantity_type: 'Strip', // Default default
    units_per_packet: 10,
    stock_packets: 0,
    stock_loose: 0,
    manufacture_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    mrp: 0,
    purchase_price: 0,
    location: '',
    purchased_from: '',
    company: ''
  };

  const [formData, setFormData] = useState<MedicineInsert>(initialFormData);

  useEffect(() => {
    if (initialData) {
      // Remove id, created_at, user_id from initialData to match MedicineInsert
      const { id, created_at, ...rest } = initialData;
      setFormData(rest as MedicineInsert);
    } else {
      setFormData(initialFormData);
    }
    // Sync editing state with view mode prop when modal opens/data changes
    setIsEditing(!isViewMode);
  }, [initialData, isViewMode, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!isEditing) return;
    const { name, value } = e.target;

    // Handle number inputs
    if (['units_per_packet', 'stock_packets', 'stock_loose', 'mrp', 'purchase_price'].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Special logic for quantity_type
    if (name === 'quantity_type') {
      if (value === 'Unit') {
        setFormData(prev => ({ 
          ...prev, 
          quantity_type: 'Unit', 
          units_per_packet: 1,
          stock_loose: 0 // Auto-set loose quantity to 0
        }));
      } else {
        setFormData(prev => ({ ...prev, quantity_type: 'Strip' }));
      }
    }
  };

  const handleToggleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (initialData) {
      // If editing existing item, revert to view mode and reset data
      setIsEditing(false);
      const { id, created_at, ...rest } = initialData;
      setFormData(rest as MedicineInsert);
    } else {
      // If adding new, close modal (standard cancel behavior)
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;

    setLoading(true);
    setError(null);

    // 1. Validation: Manufacture date cannot be future
    const today = new Date().toISOString().split('T')[0];
    if (formData.manufacture_date > today) {
      setError("Manufacturing date cannot be in the future");
      setLoading(false);
      return;
    }

    try {
      // 2. GET THE USER (Crucial Step)
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("You must be logged in to modify stock.");

      let error;

      if (initialData?.id) {
        // UPDATE Existing Medicine
        const { error: updateError } = await supabase
          .from('medicines')
          .update({
             ...formData,
             user_id: user.id
          })
          .eq('id', initialData.id);
        error = updateError;
      } else {
        // INSERT New Medicine
        const { error: insertError } = await supabase
          .from('medicines')
          .insert([{
            ...formData,     
            user_id: user.id 
          }]);
        error = insertError;
      }

      if (error) throw error;

      onSuccess();
      setFormData(initialFormData);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          <div className="px-4 pt-5 pb-4 bg-white sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {/* Title Logic: 
                      - If adding new: 'Add New Medicine'
                      - If viewing (not editing): 'Medicine Details'
                      - If editing existing: 'Edit Medicine' 
                  */}
                  {!initialData ? 'Add New Medicine' : isEditing ? 'Edit Medicine' : 'Medicine Details'}
                </h3>
                
                {/* Edit Button: Only show if we have initialData (existing item) and are NOT currently editing */}
                {initialData && !isEditing && (
                  <button 
                    onClick={handleToggleEdit}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    title="Edit Medicine"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input 
                    type="text" 
                    name="name" 
                    required 
                    value={formData.name} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-50 disabled:text-gray-500" 
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Composition</label>
                  <input 
                    type="text" 
                    name="composition" 
                    required 
                    value={formData.composition} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-50 disabled:text-gray-500" 
                  />
                </div>
              </div>

               {/* Row 2: Supply Chain (New) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Purchased From (Wholesaler)</label>
                  <input 
                    type="text" 
                    name="purchased_from" 
                    required 
                    value={formData.purchased_from} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="e.g. Health Distributors"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Company (Manufacturer)</label>
                  <input 
                    type="text" 
                    name="company" 
                    required 
                    value={formData.company} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="e.g. Sun Pharma"
                  />
                </div>
              </div>

              {/* Row 3: Batch & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Batch No</label>
                  <input 
                    type="text" 
                    name="batch_no" 
                    required 
                    value={formData.batch_no} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-50 disabled:text-gray-500" 
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Location / Rack</label>
                  <input 
                    type="text" 
                    name="location" 
                    value={formData.location} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>

              {/* Row 4: Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mfg Date</label>
                  <input 
                    type="date" 
                    name="manufacture_date" 
                    required 
                    value={formData.manufacture_date} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-50 disabled:text-gray-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
                  <input 
                    type="date" 
                    name="expiry_date" 
                    required 
                    value={formData.expiry_date} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-50 disabled:text-gray-500" 
                  />
                </div>
              </div>

               {/* Row 5: Type & Logic */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantity Type</label>
                  <select 
                    name="quantity_type" 
                    value={formData.quantity_type} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="Strip">Strip</option>
                    <option value="Unit">Unit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Units per Packet</label>
                  <input 
                    type="number" 
                    name="units_per_packet" 
                    value={formData.units_per_packet} 
                    onChange={handleChange} 
                    disabled={formData.quantity_type === 'Unit' || !isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
              </div>

               {/* Row 6: Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stock (Packets/Boxes)</label>
                  <input 
                    type="number" 
                    name="stock_packets" 
                    required 
                    value={formData.stock_packets} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-50 disabled:text-gray-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stock (Loose {formData.quantity_type}s)</label>
                  <input 
                    type="number" 
                    name="stock_loose" 
                    value={formData.stock_loose} 
                    onChange={handleChange} 
                    disabled={formData.quantity_type === 'Unit' || !isEditing}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2 border disabled:bg-gray-100 disabled:text-gray-500" 
                  />
                </div>
              </div>

              {/* Row 7: Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-700">MRP</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">₹</span>
                    </div>
                    <input 
                      type="number" 
                      step="0.01" 
                      name="mrp" 
                      required 
                      value={formData.mrp} 
                      onChange={handleChange} 
                      disabled={!isEditing}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 px-3 py-2 sm:text-sm border-gray-300 rounded-md border disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>
                 <div>
                  <label className="block text-sm font-medium text-gray-700">Purchase Price</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">₹</span>
                    </div>
                    <input 
                      type="number" 
                      step="0.01" 
                      name="purchase_price" 
                      required 
                      value={formData.purchase_price} 
                      onChange={handleChange} 
                      disabled={!isEditing}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 px-3 py-2 sm:text-sm border-gray-300 rounded-md border disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                {isEditing ? (
                  <>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                          Saving...
                        </>
                      ) : (initialData ? 'Save Changes' : 'Save Medicine')}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                   <button
                    type="button"
                    onClick={onClose}
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-1 sm:col-end-3 sm:text-sm"
                  >
                    Close
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMedicineModal;
