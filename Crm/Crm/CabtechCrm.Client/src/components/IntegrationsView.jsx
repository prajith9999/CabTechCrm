import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Settings, Save, AlertCircle, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const defaultApiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5101/api').replace(/\/$/, '');

export default function IntegrationsView({ apiBase }) {
  const API_BASE = (apiBase || defaultApiBase).replace(/\/$/, '');
  const [settings, setSettings] = useState({
    GmailAddress: '',
    GmailAppPassword: '',
    ShopifyDomain: '',
    ShopifyToken: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [gmailAutoStatus, setGmailAutoStatus] = useState(''); // '', 'saving', 'saved', 'error'
  const [settingsReady, setSettingsReady] = useState(false);
  const gmailSaveTimer = useRef(null);
  const [emails, setEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    fetchSettings();
    fetchEmails();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/Integration/settings`);
      const data = {};
      res.data.forEach(s => {
        // Handle both camelCase (PG) and PascalCase (MSSQL) key names
        const key = s.keyName || s.KeyName;
        const val = s.keyValue || s.KeyValue || '';
        if (key) data[key] = val;
      });
      setSettings(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.error('Failed to load settings:', error?.response?.status, error?.response?.data || error.message);
    } finally {
      setSettingsReady(true);
    }
  };

  /** Saves current form (Gmail + Shopify fields) to the API. */
  const persistSettings = async () => {
    await axios.post(`${API_BASE}/Integration/settings`, settingsRef.current);
  };

  // Auto-save when Gmail address + app password look complete (debounced). Full settings payload keeps Shopify fields unchanged.
  useEffect(() => {
    if (!settingsReady) return;
    const addr = (settings.GmailAddress || '').trim();
    const appPw = (settings.GmailAppPassword || '').replace(/\s/g, '').trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
    const pwOk = appPw.length >= 12;
    if (!emailOk || !pwOk) {
      setGmailAutoStatus('');
      return;
    }

    if (gmailSaveTimer.current) clearTimeout(gmailSaveTimer.current);
    setGmailAutoStatus('saving');

    gmailSaveTimer.current = setTimeout(async () => {
      try {
        // Ensure auth header is present before attempting save
        if (!axios.defaults.headers.common.Authorization) {
          console.warn('Auto-save skipped: no auth token present.');
          setGmailAutoStatus('');
          return;
        }
        await persistSettings();
        setGmailAutoStatus('saved');
        fetchEmails();
        setTimeout(() => setGmailAutoStatus(''), 5000);
      } catch (error) {
        const status = error?.response?.status;
        const detail = error?.response?.data?.message || error?.response?.data || error.message;
        console.error('Gmail auto-save failed:', status, detail);
        setGmailAutoStatus('error');
      }
    }, 1400);

    return () => {
      if (gmailSaveTimer.current) clearTimeout(gmailSaveTimer.current);
    };
  }, [settingsReady, settings.GmailAddress, settings.GmailAppPassword]);

  const fetchEmails = async () => {
    try {
      setLoadingEmails(true);
      const res = await axios.get(`${API_BASE}/enquiries`);
      const all = Array.isArray(res.data) ? res.data : [];
      const emailItems = all
        .filter(e => (e.source || '').toLowerCase() === 'email')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setEmails(emailItems);
      if (emailItems.length > 0 && !selectedEmailId) {
        setSelectedEmailId(emailItems[0].id);
      }
    } catch (error) {
      console.error('Failed to load email messages:', error);
    } finally {
      setLoadingEmails(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await persistSettings();
      setMessage('All settings saved. Background sync will use these credentials.');
      fetchEmails();
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      setMessage('Failed to save settings. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const selectedEmail = emails.find(e => e.id === selectedEmailId) || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 bg-white rounded-none shadow-sm border border-slate-200"
    >
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-none">
          <Settings size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Shopify &amp; mail integration</h2>
          <p className="text-sm text-slate-500">Configure Gmail (IMAP) and Shopify credentials used by the CRM.</p>
        </div>
      </div>

      {message && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 rounded-none border border-emerald-200 flex items-center gap-2">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700">Gmail IMAP and SMTP</h3>
          <p className="text-xs text-slate-500 mb-4">
            Same Gmail address and App Password are used for inbox sync (IMAP) and for sending workflow question emails (SMTP to smtp.gmail.com:587) when Email settings in appsettings are left empty.
            Use a Google App Password if 2-Step Verification is on.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gmail Address</label>
              <input
                type="email"
                value={settings.GmailAddress || ''}
                onChange={e => setSettings(s => ({ ...s, GmailAddress: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Must be your full Gmail address.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">App Password</label>
              <input
                type="password"
                value={settings.GmailAppPassword || ''}
                onChange={e => setSettings(s => ({ ...s, GmailAppPassword: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Generate an "App Password" in Google Security settings.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 min-h-[28px]">
            {gmailAutoStatus === 'saving' && (
              <span className="text-xs font-medium text-indigo-600">Saving Gmail…</span>
            )}
            {gmailAutoStatus === 'saved' && (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <Check size={14} aria-hidden /> Gmail saved automatically
              </span>
            )}
            {gmailAutoStatus === 'error' && (
              <span className="text-xs font-medium text-red-600">Failed to save settings. please ensure you have sufficient permissions (Admin/DevAdmin/SuperAdmin) and a stable connection.</span>
            )}
            <span className="text-[10px] text-slate-400">Pauses 1.4s after you type, then saves. You can still use Save below for Shopify.</span>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h3 className="font-semibold text-slate-700">Shopify API</h3>
          <p className="text-xs text-slate-500 mb-4">Required to sync store orders directly into the dashboard. Provide store domain and Admin API Access Token.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shopify Domain</label>
              <input
                type="text"
                value={settings.ShopifyDomain || ''}
                onChange={e => setSettings(s => ({ ...s, ShopifyDomain: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admin API Token</label>
              <input
                type="password"
                value={settings.ShopifyToken || ''}
                onChange={e => setSettings(s => ({ ...s, ShopifyToken: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Create a Custom App in Shopify &rarr; Develop Apps.</p>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-wrap justify-end gap-3 items-center">
          <p className="text-xs text-slate-500 mr-auto max-w-md">
            <span className="font-semibold text-slate-700">Save all</span> stores Gmail and Shopify together. Leave Shopify blank until you are ready.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-none hover:bg-slate-800 transition-colors disabled:opacity-70 font-bold"
          >
            <Save size={18} />
            {loading ? 'Saving...' : 'Save all settings'}
          </button>
        </div>
      </form>

      <div className="mt-10 pt-8 border-t border-slate-100">
        <div className="flex items-center justify-between mb-4" style={{ gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Email Messages</h3>
            <p className="text-xs text-slate-500">
              Sync runs about every minute after Gmail is saved. If the list stays empty, restart the API once so the database can add missing columns, then wait two minutes.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchEmails}
            disabled={loadingEmails}
            className="px-4 py-2 text-sm font-semibold rounded-none border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-60"
          >
            {loadingEmails ? 'Refreshing...' : 'Refresh Messages'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-none overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
              Inbox ({emails.length})
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {loadingEmails && emails.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">Loading email messages...</div>
              ) : emails.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No email messages found yet. Save valid Gmail settings and wait for sync.</div>
              ) : (
                emails.map((email) => (
                  <button
                    key={email.id}
                    type="button"
                    onClick={() => setSelectedEmailId(email.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-200 transition-colors ${selectedEmailId === email.id ? 'bg-indigo-50' : 'bg-white hover:bg-slate-100'}`}
                  >
                    <div className="text-sm font-semibold text-slate-800 truncate-ellipsis">{email.title || 'No Subject'}</div>
                    <div className="text-xs text-slate-600 mt-1 truncate-ellipsis">From: {email.contact?.name || 'Unknown'} ({email.contact?.email || 'No email'})</div>
                    <div className="text-[11px] text-slate-400 mt-1">{email.createdAt ? new Date(email.createdAt).toLocaleString() : ''}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-none p-4">
            {!selectedEmail ? (
              <div className="text-sm text-slate-500">Select a message to view full details.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Subject</div>
                  <div className="text-base font-semibold text-slate-800">{selectedEmail.title || 'No Subject'}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-50 border border-slate-200 rounded-none p-3">
                    <div className="text-xs text-slate-500 uppercase mb-1">Sender Name</div>
                    <div className="font-medium text-slate-800">{selectedEmail.contact?.name || 'Unknown'}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-none p-3">
                    <div className="text-xs text-slate-500 uppercase mb-1">Sender Email</div>
                    <div className="font-medium text-slate-800 break-all">{selectedEmail.contact?.email || 'N/A'}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-none p-3">
                    <div className="text-xs text-slate-500 uppercase mb-1">Phone</div>
                    <div className="font-medium text-slate-800">{selectedEmail.contact?.phoneNumber || 'N/A'}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-none p-3">
                    <div className="text-xs text-slate-500 uppercase mb-1">Received At</div>
                    <div className="font-medium text-slate-800">{selectedEmail.createdAt ? new Date(selectedEmail.createdAt).toLocaleString() : 'N/A'}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Message</div>
                  <div className="bg-slate-50 border border-slate-200 rounded-none p-3 text-sm text-slate-700 whitespace-pre-wrap max-h-[240px] overflow-y-auto">
                    {selectedEmail.description || 'No message body found.'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Attachments</div>
                  {Array.isArray(selectedEmail.attachments) && selectedEmail.attachments.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedEmail.attachments.map((a) => (
                        <li key={a.id || a.fileName} className="text-sm bg-slate-50 border border-slate-200 rounded-none px-3 py-2">
                          <span className="font-medium text-slate-800">{a.fileName}</span>
                          <span className="text-xs text-slate-500 ml-2">{a.contentType}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-500">No attachments.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
