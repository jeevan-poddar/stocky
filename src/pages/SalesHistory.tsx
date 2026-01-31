import { useState, useEffect } from 'react';
import { Search, Eye, Download, Trash2, Filter, FileText } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { type Bill, type Profile } from '../types';
import BillDetailsModal from '../components/BillDetailsModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const SalesHistory = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shopDetails, setShopDetails] = useState<Profile | null>(null);

  // Delete Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchBills();
    fetchShopDetails();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredBills(bills);
    } else {
      const lowerQuery = searchTerm.toLowerCase();
      const filtered = bills.filter(
        (bill) =>
          bill.customer_name?.toLowerCase().includes(lowerQuery) ||
          bill.customer_phone?.includes(searchTerm) ||
          bill.invoice_number?.toLowerCase().includes(lowerQuery) ||
          bill.id.toLowerCase().includes(lowerQuery)
      );
      setFilteredBills(filtered);
    }
  }, [searchTerm, bills]);

  const fetchShopDetails = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').single();
      if (error) {
        // console.log('No profile found or error fetching profile:', error);
      } else {
        setShopDetails(data);
      }
    } catch (error) {
      // console.error('Error fetching shop details:', error);
    }
  };

  const fetchBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
      setFilteredBills(data || []);
    } catch (error) {
      // console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (billId: string) => {
    setBillToDelete(billId);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!billToDelete) return;
    
    try {
        const { error } = await supabase.from('bills').delete().eq('id', billToDelete);
        if (error) throw error;
        
        // Update local state
        const updatedBills = bills.filter((b) => b.id !== billToDelete);
        setBills(updatedBills);
    } catch (error) {
        // console.error('Error deleting bill:', error);
    } finally {
        setIsDeleteModalOpen(false);
        setBillToDelete(null);
    }
  };

  const handleDownload = async (bill: Bill) => {
    try {
      // Fetch bill items
      const { data: items, error } = await supabase
        .from('bill_items')
        .select('*')
        .eq('bill_id', bill.id);

      if (error) throw error;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Helper for centered text
      const centerText = (text: string, y: number, fontSize: number = 12, isBold: boolean = false) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        const textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, y);
      };

      // Header with Shop Details
      if (shopDetails) {
        centerText(shopDetails.shop_name || 'Stocky', 20, 22, true);
        const cityState = [shopDetails.city, shopDetails.state].filter(Boolean).join(', ');
        if (cityState) centerText(cityState, 28, 12);
        if (shopDetails.phone) centerText(`Phone: ${shopDetails.phone}`, 34, 12);
        if (shopDetails.dl_number) centerText(`DL No: ${shopDetails.dl_number}`, 40, 12);
      } else {
        centerText('Stocky', 20, 22, true);
      }

      centerText('------------------------------------------------', 42, 12);

      // Invoice Details
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Invoice', 14, 50);
      doc.text(`#${bill.invoice_number || bill.id.slice(0, 8)}`, 14, 55);
      const dateStr = format(new Date(bill.created_at), 'dd/MM/yyyy');
      const timeStr = format(new Date(bill.created_at), 'hh:mm a');
      doc.text(`Date: ${dateStr}   Time: ${timeStr}`, 14, 60);

      // Customer Info
      doc.text('Bill To:', 140, 50);
      doc.setFont('helvetica', 'bold');
      doc.text(bill.customer_name, 140, 55);
      doc.setFont('helvetica', 'normal');
      if (bill.customer_phone) doc.text(`Phone: ${bill.customer_phone}`, 140, 60);
      if (bill.doctor_name) doc.text(`Doctor: ${bill.doctor_name}`, 140, 65);

      // Table
      const tableColumn = ["Medicine Name", "Qty", "Price", "Total"];
      const tableRows = items?.map(item => [
        item.medicine_name,
        item.quantity,
        `Rs. ${item.selling_price}`,
        `Rs. ${(item.quantity * item.selling_price).toFixed(2)}`
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 75,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] },
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.text(`Grand Total: Rs. ${bill.total_amount.toFixed(2)}`, 14, finalY);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const footerText = "Get Well Soon!";
      const footerWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - footerWidth) / 2, finalY + 15);

      doc.save(`Invoice_${bill.id.slice(0, 8)}.pdf`);
    } catch (error) {
      // console.error('Error generating PDF:', error);
    }
  };

  const handleViewBill = (billId: string) => {
    setSelectedBillId(billId);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <BillDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        billId={selectedBillId}
      />
      
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Bill?"
        message="Are you sure you want to delete this bill? This action cannot be undone."
        confirmText="Delete"
        isDestructive={true}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Transaction History</h1>
          <p className="text-gray-500 mt-1">View and manage your sales records</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:w-64">
             <Input 
                icon={Search}
                placeholder="Search by customer, phone or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white"
             />
          </div>
          <Button variant="outline" size="icon" className="shrink-0 bg-white">
            <Filter className="h-4 w-4 text-gray-600" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-none p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Invoice No</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Payment Mode</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary-start"></div>
                      <p>Loading transactions...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="bg-gray-50 p-4 rounded-full">
                         <FileText className="h-6 w-6 text-gray-400" />
                      </div>
                      <p>{searchTerm ? 'No transactions match your search.' : 'No transactions found.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      {bill.invoice_number || `#${bill.id.slice(0, 8)}`}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{bill.customer_name}</div>
                      {bill.customer_phone && (
                         <div className="text-xs text-gray-400">{bill.customer_phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {format(new Date(bill.created_at), 'dd MMM yyyy, hh:mm a')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600 capitalize">
                        {bill.payment_mode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-800">
                      ₹{bill.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewBill(bill.id)}
                          className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(bill)}
                          className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Download Invoice"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(bill.id)}
                          className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete Bill"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

export default SalesHistory;
