import { useState, useEffect } from 'react';
import { 
  X, 
  Loader2, 
  Edit2, 
  Pill, 
  FlaskConical, 
  Building2, 
  Truck, 
  Barcode, 
  MapPin, 
  Calendar, 
  Layers, 
  Box, 
  IndianRupee,
  Package
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { MedicineInsert, Medicine } from '../types';
import { triggerLowStockAlert } from '../lib/notificationUtils';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface AddMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Medicine | null;
  isViewMode?: boolean;
  lowStockThreshold?: number;
}

const AddMedicineModal: React.FC<AddMedicineModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialData,
  isViewMode = false,
  lowStockThreshold = 10
}) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(!isViewMode);

  const initialFormData: MedicineInsert = {
    name: '',
    composition: '',
    batch_no: '',
    quantity_type: 'Strip',
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
      const { id, created_at, ...rest } = initialData;
      setFormData(rest as MedicineInsert);
    } else {
      setFormData(initialFormData);
    }
    setIsEditing(!isViewMode);
  }, [initialData, isViewMode, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!isEditing) return;
    const { name, value } = e.target;

    if (['units_per_packet', 'stock_packets', 'stock_loose', 'mrp', 'purchase_price'].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (name === 'quantity_type') {
      if (value === 'Unit') {
        setFormData(prev => ({ 
          ...prev, 
          quantity_type: 'Unit', 
          units_per_packet: 1,
          stock_loose: 0 
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
      setIsEditing(false);
      const { id, created_at, ...rest } = initialData;
      setFormData(rest as MedicineInsert);
    } else {
      onClose();
    }
  };

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;

    setLoading(true);
    setErrors({});
    setGlobalError(null);

    const newErrors: {[key: string]: string} = {};
    const today = new Date().toISOString().split('T')[0];

    if (!formData.name.trim()) newErrors.name = "This field is required";
    if (!formData.composition.trim()) newErrors.composition = "This field is required";
    if (!formData.purchased_from.trim()) newErrors.purchased_from = "This field is required";
    if (!formData.company.trim()) newErrors.company = "This field is required";
    if (!formData.batch_no.trim()) newErrors.batch_no = "This field is required";
    
    if (!formData.manufacture_date) {
        newErrors.manufacture_date = "This field is required";
    } else if (formData.manufacture_date > today) {
        newErrors.manufacture_date = "Manuf. date cannot be in the future";
    }

    if (!formData.expiry_date) newErrors.expiry_date = "This field is required";

    if (!formData.mrp) newErrors.mrp = "This field is required";
    if (!formData.purchase_price) newErrors.purchase_price = "This field is required";
    
    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setLoading(false);
        return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("You must be logged in to modify stock.");

      let error;

      if (initialData?.id) {
        const { error: updateError } = await supabase
          .from('medicines')
          .update({
             ...formData,
             user_id: user.id
          })
          .eq('id', initialData.id);
        error = updateError;
      } else {
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
      
      if (formData.stock_packets <= lowStockThreshold) {
          triggerLowStockAlert(formData.name, formData.stock_packets);
      }

      setFormData(initialFormData);
      onClose();
    } catch (err: any) {
      setGlobalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        
        <div className="fixed inset-0 transition-opacity bg-brand-primary-start/10 backdrop-blur-sm" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-soft transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full border border-white/50">
          <div className="px-6 py-6 bg-white sm:p-8">
            <div className="flex justify-between items-center pb-6 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold text-gray-800">
                  {/* Title Logic */}
                  {!initialData ? 'Add New Medicine' : isEditing ? 'Edit Medicine' : 'Medicine Details'}
                </h3>
                
                {initialData && !isEditing && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleToggleEdit}
                    className="rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                    title="Edit Medicine"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            {globalError && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                {globalError}
              </div>
            )}

            <form onSubmit={handleSaveMedicine} className="space-y-6">
              {/* Row 1: Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-1">
                  <Input 
                    label="Name"
                    icon={Pill}
                    name="name" 
                    autoComplete="off"
                    value={formData.name} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    error={errors.name}
                    placeholder="Medicine Name"
                  />
                </div>
                <div className="sm:col-span-1">
                  <Input 
                    label="Composition"
                    icon={FlaskConical}
                    name="composition" 
                    autoComplete="off"
                    value={formData.composition} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    error={errors.composition}
                    placeholder="Generic Name / Salt"
                  />
                </div>
              </div>

               {/* Row 2: Supply Chain */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-1">
                  <Input 
                    label="Purchased From"
                    icon={Truck}
                    name="purchased_from" 
                    autoComplete="off"
                    value={formData.purchased_from} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    error={errors.purchased_from}
                    placeholder="Wholesaler Name"
                  />
                </div>
                <div className="sm:col-span-1">
                  <Input 
                    label="Company"
                    icon={Building2}
                    name="company" 
                    autoComplete="off"
                    value={formData.company} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    error={errors.company}
                    placeholder="Manufacturer"
                  />
                </div>
              </div>

              {/* Row 3: Batch & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                 <div className="sm:col-span-1">
                  <Input
                    label="Batch No"
                    icon={Barcode}
                    name="batch_no"
                    autoComplete="off"
                    value={formData.batch_no}
                    onChange={handleChange}
                    disabled={!isEditing}
                    error={errors.batch_no}
                    placeholder="Batch Number"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input 
                    label="Location / Rack"
                    icon={MapPin}
                    name="location" 
                    value={formData.location} 
                    onChange={handleChange} 
                    disabled={!isEditing}
                    placeholder="Shelf Location"
                  />
                </div>
              </div>

              {/* Row 4: Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Input
                    label="Mfg Date"
                    type="date"
                    icon={Calendar}
                    name="manufacture_date"
                    value={formData.manufacture_date}
                    onChange={handleChange}
                    disabled={!isEditing}
                    error={errors.manufacture_date}
                  />
                </div>
                <div>
                  <Input
                    label="Expiry Date"
                    type="date"
                    icon={Calendar}
                    name="expiry_date"
                    value={formData.expiry_date}
                    onChange={handleChange}
                    disabled={!isEditing}
                    error={errors.expiry_date}
                  />
                </div>
              </div>

               {/* Row 5: Type & Logic */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 ml-1 mb-2">Quantity Type</label>
                  <div className="relative flex items-center bg-input-bg rounded-2xl">
                    <div className="pl-4 text-gray-400">
                      <Layers size={20} />
                    </div>
                    <select 
                      name="quantity_type" 
                      value={formData.quantity_type} 
                      onChange={handleChange} 
                      disabled={!isEditing}
                      className="w-full bg-transparent border-none p-4 text-gray-700 focus:ring-0 appearance-none"
                    >
                      <option value="Strip">Strip</option>
                      <option value="Unit">Unit</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Input
                    label="Units per Packet"
                    type="number"
                    icon={Package}
                    name="units_per_packet"
                    value={formData.units_per_packet}
                    onChange={handleChange}
                    disabled={formData.quantity_type === 'Unit' || !isEditing}
                  />
                </div>
              </div>

               {/* Row 6: Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Input
                    label="Stock (Packets/Boxes)"
                    type="number"
                    icon={Box}
                    name="stock_packets"
                    autoComplete="off"
                    value={formData.stock_packets}
                    onChange={handleChange}
                    disabled={!isEditing}
                    error={errors.stock_packets}
                  />
                </div>
                <div>
                   <Input
                    label={`Stock (Loose ${formData.quantity_type}s)`}
                    type="number"
                    icon={Pill}
                    name="stock_loose"
                    value={formData.stock_loose}
                    onChange={handleChange}
                    disabled={formData.quantity_type === 'Unit' || !isEditing}
                  />
                </div>
              </div>

              {/* Row 7: Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div>
                  <Input
                    label="MRP"
                    type="number"
                    step="0.01"
                    icon={IndianRupee}
                    name="mrp"
                    autoComplete="off"
                    value={formData.mrp}
                    onChange={handleChange}
                    disabled={!isEditing}
                    error={errors.mrp}
                  />
                </div>
                 <div>
                  <Input
                    label="Purchase Price"
                    type="number"
                    step="0.01"
                    icon={IndianRupee}
                    name="purchase_price"
                    autoComplete="off"
                    value={formData.purchase_price}
                    onChange={handleChange}
                    disabled={!isEditing}
                    error={errors.purchase_price}
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 flex gap-4 justify-end">
                {isEditing ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="secondary" // Mint Green for Save
                      disabled={loading}
                      className="w-full sm:w-auto"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                          Saving...
                        </>
                      ) : (initialData ? 'Save Changes' : 'Save Medicine')}
                    </Button>
                  </>
                ) : (
                   <Button
                    type="button"
                    variant="primary"
                    onClick={onClose}
                    className="w-full sm:w-auto"
                  >
                    Close
                  </Button>
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
