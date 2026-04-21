import React, { useState } from 'react';
import { ShoppingCart, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ShopifyOrdersView({ enquiries }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter only Shopify enquiries (camelCase — ASP.NET Core returns camelCase JSON)
  const shopifyOrders = enquiries.filter(e => e.source === 'Shopify' && e.shopifyOrder);

  const filtered = shopifyOrders.filter(e => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const s = e.shopifyOrder;
    return (
      (e.title || '').toLowerCase().includes(term) ||
      (s?.shopifyOrderId || '').toLowerCase().includes(term) ||
      (e.contact?.name || '').toLowerCase().includes(term) ||
      (e.contact?.email || '').toLowerCase().includes(term) ||
      (e.contact?.company || '').toLowerCase().includes(term) ||
      (s?.paymentStatus || '').toLowerCase().includes(term) ||
      (s?.fulfillmentStatus || '').toLowerCase().includes(term) ||
      (s?.channel || '').toLowerCase().includes(term) ||
      (s?.deliveryMethod || '').toLowerCase().includes(term) ||
      String(s?.totalAmount || '').includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-none flex items-center justify-center shadow-sm">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">Shopify Module</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest opacity-70">Order Processing & Fulfillment</p>
          </div>
        </div>
        <div className="relative" style={{ marginLeft: 'auto' }}>
          <input
            type="text"
            className="pl-4 pr-4 py-2 border border-slate-200 rounded-none text-xs font-bold w-64 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-sm transition-all"
            style={{ minWidth: '260px' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-none shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f9fafb] border-b border-slate-200">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Order Record</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Date</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Identity</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Payment</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fulfillment</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <ShoppingCart size={48} className="text-slate-200 mb-4" />
                      <p>No orders found.</p>
                      <p className="text-xs mt-1">Make sure Shopify integration is configured and running.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(enquiry => {
                  const s = enquiry.shopifyOrder;
                  return (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={enquiry.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-5 min-w-[200px]">
                        <div className="font-bold text-slate-900 mb-0.5 truncate-ellipsis">{enquiry.title}</div>
                        {s.shopifyOrderId && <div className="text-[11px] font-mono text-slate-400 uppercase tracking-tight truncate-ellipsis">ID: {s.shopifyOrderId}</div>}
                      </td>
                      <td className="px-6 py-5 text-slate-500 font-semibold text-xs whitespace-nowrap">
                        {s.orderDate ? new Date(s.orderDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-5 min-w-[150px]">
                        <div className="font-bold text-slate-900 mb-0.5 truncate-ellipsis">{enquiry.contact?.name || 'Unknown'}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] truncate-ellipsis">{enquiry.contact?.email}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        ${(s.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-none text-xs font-semibold ${s.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                            s.paymentStatus === 'refunded' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                          }`}>
                          {s.paymentStatus || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-none text-xs font-semibold ${s.fulfillmentStatus === 'fulfilled' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                          {s.fulfillmentStatus || 'unfulfilled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {s.deliveryMethod || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {s.channel || 'Online'}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
