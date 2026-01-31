import { useState, useEffect } from 'react';
import { Search, Eye, Download, Trash2, Filter } from 'lucide-react';
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
      if (!error) setShopDetails(data);
    } catch (error) {
      // Handle error silently
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
      // Handle error silently
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
      const updatedBills = bills.filter((b) => b.id !== billToDelete);
      setBills(updatedBills);
    } catch (error) {
      // Handle error silently
    } finally {
      setIsDeleteModalOpen(false);
      setBillToDelete(null);
    }
  };

  // --- NEW PROFESSIONAL PDF GENERATOR ---
  const handleDownload = async (bill: Bill) => {
    try {
      // 1. Fetch Items
      const { data: items, error } = await supabase
        .from('bill_items')
        .select('*')
        .eq('bill_id', bill.id);

      if (error) throw error;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // --- HEADER BACKGROUND ---
      doc.setFillColor(249, 250, 251);
      doc.rect(0, 0, pageWidth, 40, 'F');

      // --- SHOP DETAILS (Left) ---
      doc.setFontSize(22);
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.text(shopDetails?.shop_name || 'Stocky Pharmacy', 15, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);

      let yPos = 26;
      if (shopDetails?.city) {
        doc.text(`${shopDetails.city}, ${shopDetails.state || ''}`, 15, yPos);
        yPos += 5;
      }
      if (shopDetails?.phone) {
        doc.text(`Phone: ${shopDetails.phone}`, 15, yPos);
        yPos += 5;
      }
      if (shopDetails?.dl_number) {
        doc.text(`DL No: ${shopDetails.dl_number}`, 15, yPos);
      }

      // --- INVOICE LABEL (Right) ---
      doc.setFontSize(24);
      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', pageWidth - 15, 20, { align: 'right' });

      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`#${bill.invoice_number || bill.id.slice(0, 8)}`, pageWidth - 15, 28, { align: 'right' });
      doc.text(format(new Date(bill.created_at), 'dd MMM yyyy'), pageWidth - 15, 33, { align: 'right' });

      // --- SEPARATOR ---
      doc.setDrawColor(220, 220, 220);
      doc.line(15, 45, pageWidth - 15, 45);

      // --- BILL TO SECTION ---
      const startY = 55;

      // Box for Customer
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(230, 230, 230);
      doc.roundedRect(15, startY, 90, 35, 2, 2, 'S');

      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('BILL TO', 20, startY + 8);

      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.text(bill.customer_name, 20, startY + 16);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      if (bill.customer_phone) doc.text(`Phone: ${bill.customer_phone}`, 20, startY + 24);
      if (bill.doctor_name) doc.text(`Dr. Ref: ${bill.doctor_name}`, 20, startY + 30);

      // --- PAYMENT INFO (Right) ---
      doc.roundedRect(115, startY, pageWidth - 130, 35, 2, 2, 'S');

      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('PAYMENT INFO', 120, startY + 8);

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Status: Paid`, 120, startY + 16);
      doc.text(`Mode: ${bill.payment_mode || 'Cash'}`, 120, startY + 22);
      doc.text(`Time: ${format(new Date(bill.created_at), 'hh:mm a')}`, 120, startY + 28);

      // --- TABLE ---
      const tableColumn = ["Item", "Qty", "Price", "Total"];
      const tableRows = items?.map(item => [
        item.medicine_name,
        item.quantity,
        `Rs. ${item.selling_price.toFixed(2)}`,
        `Rs. ${(item.quantity * item.selling_price).toFixed(2)}`
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: startY + 45,
        theme: 'plain',
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: [60, 60, 60],
          fontStyle: 'bold',
          halign: 'left'
        },
        styles: {
          fontSize: 10,
          cellPadding: 4,
          textColor: [60, 60, 60]
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 30, halign: 'right' }
        },
      });

      // --- FOOTER & TOTALS ---
      const finalY = (doc as any).lastAutoTable.finalY + 10;

      // Divider Line
      doc.setDrawColor(220, 220, 220);
      doc.line(15, finalY, pageWidth - 15, finalY);

      // Grand Total
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(`Total: Rs. ${bill.total_amount.toFixed(2)}`, pageWidth - 15, finalY + 10, { align: 'right' });

      // --- SIGNATURE SECTION (LEFT SIDE) ---
      const signatureY = finalY + 35;

      // 1. Draw Line for Signature (Left Side)
      doc.setDrawColor(100, 100, 100);
      doc.line(15, signatureY, 65, signatureY);

      // 2. "Authorized Signature" Text (Centered under line)
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Authorized Signature', 40, signatureY + 5, { align: 'center' });

      // (Removed the "For ShopName" text as requested)

      // --- BOTTOM THANK YOU ---
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 15, { align: 'center' });

      doc.save(`Invoice_${bill.id.slice(0, 8)}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Transaction History</h1>
          <p className="text-gray-500 mt-1">View and manage your sales records</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:w-64">
            <Input
              icon={Search}
              placeholder="Search by customer..."
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

      {/* Table Card */}
      <Card className="overflow-hidden border-none p-0 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Invoice No</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Payment</th>
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
                      <p>{searchTerm ? 'No transactions match.' : 'No transactions found.'}</p>
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
                      {format(new Date(bill.created_at), 'dd MMM, hh:mm a')}
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
                      <div className="flex items-center justify-end gap-1 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewBill(bill.id)}
                          className="h-8 w-8 text-gray-400 hover:text-blue-600 "
                          title="View"
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
                          title="Delete"
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