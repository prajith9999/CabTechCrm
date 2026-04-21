import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Bell, Mail, ShoppingCart, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import IntegrationsView from './IntegrationsView';

export default function DeveloperIntegrationHub({ API_BASE, openInfoPopup }) {
  const [notifications, setNotifications] = useState([]);
  const [emails, setEmails] = useState([]);
  const [shopifyRows, setShopifyRows] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const [nRes, eRes, enqRes] = await Promise.all([
        axios.get(`${API_BASE}/Core/notifications/inbox`),
        axios.get(`${API_BASE}/Core/emails`),
        axios.get(`${API_BASE}/enquiries`)
      ]);
      setNotifications(Array.isArray(nRes.data) ? nRes.data : []);
      const allEmails = Array.isArray(eRes.data) ? eRes.data : [];
      setEmails(
        allEmails
          .filter((x) => ((x.direction || x.Direction || '') + '').toLowerCase() === 'incoming')
          .slice(0, 25)
      );
      const enq = Array.isArray(enqRes.data) ? enqRes.data : [];
      setShopifyRows(
        enq
          .filter((x) => (x.source || '').toLowerCase() === 'shopify')
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 25)
      );
    } catch (err) {
      console.error('Developer hub feed load failed:', err);
      openInfoPopup('Feed error', 'Could not load notifications, mail, or enquiries. Check API access.', 'error');
    } finally {
      setLoadingFeed(false);
    }
  }, [API_BASE, openInfoPopup]);

  useEffect(() => {
    loadFeed();
    const t = setInterval(loadFeed, 60000);
    return () => clearInterval(t);
  }, [loadFeed]);

  const markNotifRead = async (id) => {
    try {
      await axios.post(`${API_BASE}/Core/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, IsRead: true } : n)));
    } catch {
      openInfoPopup('Error', 'Could not mark notification read.', 'error');
    }
  };

  const unreadNotifs = notifications.filter((n) => !(n.isRead ?? n.IsRead)).length;

  return (
    <div className="space-y-8">
      <div className="rounded-none border border-orange-100 bg-orange-50/40 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-800">Mail and Shopify control centre</p>
        <p className="text-xs text-slate-600 mt-1">
          Configure credentials below. Incoming sync notifications appear in the feed. Email enquiries and Shopify orders are created automatically when sync runs.
        </p>
      </div>

      <IntegrationsView apiBase={API_BASE} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Bell className="text-orange-600" size={20} />
          Live feed
          {unreadNotifs > 0 && (
            <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-none">{unreadNotifs} new</span>
          )}
        </h3>
        <button
          type="button"
          onClick={loadFeed}
          disabled={loadingFeed}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-none border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loadingFeed ? 'animate-spin' : ''} />
          Refresh feed
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <motion.div layout className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <Bell size={14} /> Notifications
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`p-3 text-sm ${(n.isRead ?? n.IsRead) ? 'bg-white' : 'bg-amber-50/60'}`}>
                  <div className="flex justify-between gap-2 items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">{n.type ?? n.Type}</span>
                      <p className="text-slate-800 font-medium mt-0.5">{n.message ?? n.Message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{(n.createdAt ?? n.CreatedAt) ? new Date(n.createdAt ?? n.CreatedAt).toLocaleString() : ''}</p>
                    </div>
                    {!(n.isRead ?? n.IsRead) && (
                      <button
                        type="button"
                        onClick={() => markNotifRead(n.id)}
                        className="shrink-0 text-[10px] font-bold text-orange-600 hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div layout className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <Mail size={14} /> Recent incoming mail
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {emails.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">No incoming messages in the unified inbox yet.</div>
            ) : (
              emails.map((m) => (
                <div key={m.id} className="p-3 text-sm">
                  <div className="font-semibold text-slate-800 line-clamp-1">{m.subject ?? m.Subject ?? '(No subject)'}</div>
                  <div className="text-xs text-slate-500 mt-1">{(m.sender ?? m.Sender) || '—'} · {(m.senderEmail ?? m.SenderEmail) || ''}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{(m.receivedAt ?? m.ReceivedAt) ? new Date(m.receivedAt ?? m.ReceivedAt).toLocaleString() : ''}</div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div layout className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <ShoppingCart size={14} /> Shopify enquiries
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {shopifyRows.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">No Shopify-linked enquiries yet. Save API credentials and wait for sync.</div>
            ) : (
              shopifyRows.map((e) => (
                <div key={e.id} className="p-3 text-sm">
                  <div className="font-semibold text-slate-800 line-clamp-1">{e.title}</div>
                  <div className="text-xs text-slate-600 mt-1">{e.contact?.name || 'Customer'} · Ref {e.referenceNumber}</div>
                  {e.shopifyOrder && (
                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                      Pay {e.shopifyOrder.paymentStatus || '—'} · Fulfill {e.shopifyOrder.fulfillmentStatus || '—'}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
