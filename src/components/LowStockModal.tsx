import { X, Copy, AlertTriangle, MapPin } from 'lucide-react';
import { type Medicine } from '../types';

interface LowStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockItems: Medicine[];
}

const LowStockModal = ({ isOpen, onClose, lowStockItems }: LowStockModalProps) => {
  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here if desired
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg border border-red-200">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-700">Low Stock Alert</h2>
              <p className="text-sm text-red-600">
                {lowStockItems.length} items below minimum threshold
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-red-400 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Table Container with Scroll */}
        <div className="flex-1 overflow-y-auto p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3">Medicine Name</th>
                <th className="px-6 py-3">Current Stock</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lowStockItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No low stock items found.
                  </td>
                </tr>
              ) : (
                lowStockItems.map((item) => (
                  <tr key={item.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-bold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.composition}</p>
                    </td>
                    <td className="px-6 py-3">
                      <span className="font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                        {item.stock_packets} Packs + {item.stock_loose} Loose
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        {item.location || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => copyToClipboard(item.name)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 hover:text-gray-900 transition-colors"
                        title="Copy Name"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default LowStockModal;
