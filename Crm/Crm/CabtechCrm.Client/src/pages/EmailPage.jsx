import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Mail, RefreshCw, Smartphone, Inbox, User, Calendar, Paperclip,
  ExternalLink, Search, PenLine, Send, FileText, Archive, Trash2,
  X, Star, AlertCircle, ChevronRight, RotateCcw, Settings, History, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EmailPage = ({ API_BASE, refreshSignal = 0, onViewPdf }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Primary');
  const [activeFolder, setActiveFolder] = useState('Inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dateFilter, setDateFilter] = useState('All'); // 'All', 'Week', 'Month', 'Year'
  const [settings, setSettings] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [composeAttachments, setComposeAttachments] = useState([]);
  const fileInputRef = useRef(null);

  // Resizable Panes State
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [inboxWidth, setInboxWidth] = useState(380);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingInbox, setIsResizingInbox] = useState(false);

  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  // SPEED FIX: Use the dedicated /Core/emails endpoint instead of loading
  // all enquiries and filtering client-side. This is ~10x faster.
  const fetchEmails = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/Core/emails`);
      const all = Array.isArray(response.data) ? response.data : [];
      // Sort newest first
      const sorted = [...all].sort(
        (a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime()
               - new Date(a.receivedAt || a.createdAt || 0).getTime()
      );
      setEmails(sorted);
      // Auto-select first email only on initial load
      setSelectedId(prev => (prev === null && sorted.length > 0 ? sorted[0].id : prev));
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [API_BASE]);

  // Initial load
  useEffect(() => {
    fetchEmails(false);
  }, [fetchEmails]);

  // SPEED FIX: Poll every 30 seconds for new emails silently (no loading spinner)
  useEffect(() => {
    const interval = setInterval(() => fetchEmails(true), 30000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  // Refresh when SignalR fires a notification
  useEffect(() => {
    if (refreshSignal > 0) {
      fetchEmails(true);
    }
  }, [refreshSignal, fetchEmails]);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/Core/settings`);
      const dict = {};
      response.data.forEach(s => { dict[s.keyName] = s.keyValue; });
      setSettings(dict);
    } catch (err) { console.error('Failed to fetch settings', err); }
  }, [API_BASE]);

  const updateSetting = async (key, value) => {
    try {
      await axios.post(`${API_BASE}/Core/settings/upsert`, { keyName: key, keyValue: value });
      fetchSettings();
    } catch (err) { console.error('Failed to update setting', err); }
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSend = async () => {
    if (!composeTo || !composeSubject) return;
    setIsSending(true);
    try {
      // Convert files to Base64 for delivery
      const atts = await Promise.all(composeAttachments.map(async (file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
             const base64Content = reader.result.split(',')[1];
             resolve({ 
               fileName: file.name, 
               contentType: file.type || 'application/octet-stream',
               base64Content 
             });
          };
          reader.readAsDataURL(file);
        });
      }));

      await axios.post(`${API_BASE}/Core/emails/send`, {
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
        attachments: atts
      });
      setShowCompose(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setComposeAttachments([]);
      fetchEmails(true);
    } catch (err) {
      alert("Failed to send email. Check credentials in settings.");
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setComposeAttachments(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setComposeAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Resize Handling Logic
  const startSidebarResize = useCallback((e) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const startInboxResize = useCallback((e) => {
    e.preventDefault();
    setIsResizingInbox(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingSidebar(false);
    setIsResizingInbox(false);
  }, []);

  const resize = useCallback((e) => {
    if (isResizingSidebar) {
      const newWidth = e.clientX;
      if (newWidth > 180 && newWidth < 450) {
        setSidebarWidth(newWidth);
      }
    } else if (isResizingInbox) {
      const newWidth = e.clientX - sidebarWidth;
      if (newWidth > 280 && newWidth < 800) {
        setInboxWidth(newWidth);
      }
    }
  }, [isResizingSidebar, isResizingInbox, sidebarWidth]);

  useEffect(() => {
    if (isResizingSidebar || isResizingInbox) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizingSidebar, isResizingInbox, resize, stopResizing]);

  const groupedEmails = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today); lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today); lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastYear = new Date(today); lastYear.setFullYear(lastYear.getFullYear() - 1);

    const filtered = emails.filter(e => {
      const date = new Date(e.receivedAt || e.createdAt);
      
      // Date Filter logic
      if (dateFilter === 'Week' && date < lastWeek) return false;
      if (dateFilter === 'Month' && date < lastMonth) return false;
      if (dateFilter === 'Year' && date < lastYear) return false;

      const term = searchTerm.toLowerCase();
      const matchesSearch = (
        (e.subject || '').toLowerCase().includes(term) ||
        (e.sender || '').toLowerCase().includes(term) ||
        (e.senderEmail || '').toLowerCase().includes(term) ||
        (e.preview || '').toLowerCase().includes(term)
      );

      if (activeFolder === 'Inbox') return matchesSearch && e.direction !== 'Outgoing';
      if (activeFolder === 'Sent')  return matchesSearch && e.direction === 'Outgoing';
      if (activeFolder === 'Activity') return matchesSearch; // All
      return matchesSearch;
    });

    const groups = { Today: [], Yesterday: [], Earlier: [] };
    filtered.forEach(e => {
      const eDate = new Date(e.receivedAt || e.createdAt);
      const dayStart = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate());
      
      if (dayStart.getTime() === today.getTime()) groups.Today.push(e);
      else if (dayStart.getTime() === yesterday.getTime()) groups.Yesterday.push(e);
      else groups.Earlier.push(e);
    });
    return groups;
  }, [emails, searchTerm, activeFolder, dateFilter]);

  const selectedEmail = emails.find(e => e.id === selectedId) || null;

  // Count unread for badge
  const unreadCount = emails.filter(e => !e.isRead && e.direction !== 'Outgoing').length;
  const sentCount   = emails.filter(e => e.direction === 'Outgoing').length;

  const categories = ['Primary', 'Promotions', 'Social', 'Updates'];
  const sidebarItems = [
    { id: 'Activity', icon: <History size={18} />, label: 'All Activity' },
    { id: 'Inbox', icon: <Inbox size={18} />, label: 'Inbox', count: emails.filter(e => e.direction !== 'Outgoing').length },
    { id: 'Sent',  icon: <Send size={18} />,  label: 'Sent',  count: sentCount },
    { id: 'Drafts',  icon: <FileText size={18} />, label: 'Drafts' }
  ];

  const getDomainIcon = (email) => {
    const low = (email || '').toLowerCase();
    let bg = "bg-indigo-50", color = "text-indigo-600", char = (email?.[0] || 'U').toUpperCase();
    if (low.includes('google') || low.includes('gmail')) { bg = "bg-red-50"; color = "text-red-500"; char = "G"; }
    else if (low.includes('linkedin')) { bg = "bg-blue-50"; color = "text-blue-600"; char = "in"; }
    else if (low.includes('shopify'))  { bg = "bg-green-50"; color = "text-green-600"; char = "S"; }
    return <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center ${color} text-sm font-bold shadow-sm shrink-0`}>{char}</div>;
  };

  return (
    <div className={`flex h-screen bg-white overflow-hidden border-t border-l border-slate-200 ${isResizingSidebar || isResizingInbox ? 'select-none cursor-col-resize' : ''}`}>
      {/* 1. Module Sidebar */}
      <div
        style={{ width: `${sidebarWidth}px` }}
        className="bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 overflow-hidden relative"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">

            <div className="overflow-hidden">
              <div className="text-[13px] font-bold text-slate-900 truncate">Email</div>
              <div className="text-[10px] text-slate-500 font-medium truncate">prajithsivansivan@gmail.com</div>
            </div>
          </div>

          <button
            onClick={() => setShowCompose(true)}
            className="w-full py-3 text-white rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 transition-all mb-8 font-bold text-xs"
            style={{ backgroundColor: '#4f46e5' }}
          >
            <PenLine size={18} />
            Write Email
          </button>

          <nav className="space-y-1">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 px-2">Core Mail</div>
            {sidebarItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveFolder(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${activeFolder === item.id
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-white/50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  {React.cloneElement(item.icon, { size: 18 })}
                  <span className="text-[12px] font-bold tracking-tight">{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span className="text-[10px] font-black px-2 py-0.5 bg-slate-200 text-slate-700 rounded-lg">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => fetchEmails(false)}
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"
            title="Refresh emails"
          >
            <RotateCcw size={14} />
          </button>
          
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"
            title="Mail Settings"
          >
            <Settings size={14} />
          </button>
        </div>

        {/* Resizer Sidebar */}
        <div
          onMouseDown={startSidebarResize}
          className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-[60] transition-colors ${isResizingSidebar ? 'bg-indigo-500/20' : 'hover:bg-indigo-500/10'}`}
        />
      </div>

      {/* 2. Message List */}
      <div
        style={{ width: `${inboxWidth}px` }}
        className="flex flex-col shrink-0 bg-white border-r border-slate-200 relative overflow-hidden"
      >
        <div className="p-6 pb-2 border-b border-slate-50">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{activeFolder}</h1>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">
            {activeCategory} • {emails.length} Messages
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-lg w-fit border border-slate-100 mb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-tight transition-all ${activeCategory === cat ? 'bg-black text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 border-t border-slate-50 pt-4">
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Range</span>
            </div>
            <div className="flex gap-1">
              {['All', 'Week', 'Month', 'Year'].map(f => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border transition-all ${dateFilter === f ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-400 hover:border-slate-400'}`}
                >
                  {f === 'All' ? 'Infinity' : f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading && emails.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading emails...</div>
            </div>
          ) : (
            Object.entries(groupedEmails).map(([group, list]) => {
              if (list.length === 0) return null;
              return (
                <div key={group} className="px-5 border-b border-slate-50 last:border-0 py-6">
                  <div className="flex items-center gap-3 mb-4 px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{group}</span>
                    <div className="flex-1 h-[1px] bg-slate-50" />
                    <span className="text-[11px] font-black text-slate-900">{list.length}</span>
                  </div>

                  <div className="space-y-1">
                    {list.map(email => (
                      <button
                        key={email.id}
                        onClick={() => setSelectedId(email.id)}
                        className={`w-full flex items-center gap-4 py-2.5 px-3 rounded-xl transition-all border ${selectedId === email.id
                          ? 'bg-indigo-50/50 border-indigo-100 shadow-sm'
                          : 'bg-white border-transparent hover:bg-slate-50'
                          }`}
                      >
                        <div className="shrink-0">{getDomainIcon(email.senderEmail)}</div>
                        <div className="flex-1 min-w-0 flex flex-col text-left">
                          <div className="flex items-center justify-between gap-4">
                            {/* Bold sender name if unread */}
                            <span className={`text-xs truncate-ellipsis pr-4 ${!email.isRead ? 'font-black text-slate-900' : 'font-bold text-slate-600'}`}>
                              {email.sender || 'Unknown'}
                            </span>
                            <span className="text-[9px] font-medium text-slate-400 shrink-0">
                              {new Date(email.receivedAt || email.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[11px] truncate-ellipsis flex-1 ${!email.isRead ? 'font-semibold text-slate-700' : 'font-medium text-slate-500'}`}>
                              {email.subject || '(No Subject)'}
                            </span>
                          </div>
                          {email.preview && (
                            <span className="text-[10px] text-slate-400 truncate-ellipsis mt-0.5">{email.preview}</span>
                          )}
                        </div>
                        {!email.isRead && (
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_8px_rgba(79,70,229,0.4)]" />
                        )}
                        {selectedId === email.id && <ChevronRight size={12} className="text-indigo-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Resizer Inbox */}
        <div
          onMouseDown={startInboxResize}
          className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-[60] transition-colors ${isResizingInbox ? 'bg-indigo-500/20' : 'hover:bg-indigo-500/10'}`}
        />
      </div>

      {/* 3. Detail Pane */}
      <AnimatePresence mode="wait">
        {selectedId && selectedEmail ? (
          <motion.div
            key={selectedEmail.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex-1 bg-slate-50/50 flex flex-col min-w-0"
          >
            <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-200 shadow-sm z-10 font-sans">
              <button onClick={() => setSelectedId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                <X size={18} />
              </button>
              <div className="flex items-center gap-1">
                <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><Star size={16} /></button>
                <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><Trash2 size={16} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar min-w-0">
              <div className="space-y-4 min-w-0 font-sans">
                <h2 className="text-lg font-bold text-slate-900 leading-tight tracking-tight break-words whitespace-pre-wrap">
                  {selectedEmail.subject || '(No Subject)'}
                </h2>
                <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm overflow-hidden mb-4">
                  <div className="flex items-center gap-3">
                    {getDomainIcon(selectedEmail.senderEmail)}
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-slate-900 truncate">{selectedEmail.sender}</div>
                      <div className="text-[10px] font-medium text-slate-500 truncate">{selectedEmail.senderEmail}</div>
                    </div>
                    <div className="ml-auto text-[10px] text-slate-400">
                      {new Date(selectedEmail.receivedAt || selectedEmail.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 min-h-[350px] mb-8 overflow-hidden font-sans">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                  Email Body
                </div>
                <div
                  className="text-[12px] leading-relaxed text-slate-600 break-words whitespace-pre-wrap font-medium"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body || selectedEmail.preview || '(No content)' }}
                />
              </div>

              {selectedEmail.attachments?.length > 0 && (
                <div className="space-y-3 font-sans">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Paperclip size={10} />
                    Files ({selectedEmail.attachments.length})
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {selectedEmail.attachments.map(att => (
                      <div
                        key={att.id}
                        onClick={() => onViewPdf && onViewPdf(att.id)}
                        className="bg-white border border-slate-200 p-2.5 rounded-lg flex items-center justify-between group hover:border-indigo-300 transition-all cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-red-50 text-red-500 flex items-center justify-center font-bold text-[8px] shrink-0">PDF</div>
                          <div className="text-[11px] font-bold text-slate-900 truncate max-w-[200px]">{att.fileName}</div>
                        </div>
                        <ExternalLink size={12} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 bg-slate-50 flex items-center justify-center text-center p-12">
            <div className="max-w-[200px]">
              <Mail size={40} className="text-slate-200 mx-auto mb-4" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Message Selected</div>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Please select an enquiry from the list to view the full communication history and files.</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Compose Modal */}
      <AnimatePresence>
        {showCompose && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-100 font-sans">
              <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PenLine size={18} />
                  <span className="font-bold text-sm">New Message</span>
                </div>
                <button onClick={() => setShowCompose(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">To</label>
                  <input type="email" value={composeTo} onChange={e => setComposeTo(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                  <input type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Message</label>
                  <textarea rows={5} value={composeBody} onChange={e => setComposeBody(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-medium resize-none leading-relaxed" />
                </div>

                {composeAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {composeAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 group">
                        <Paperclip size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{file.name}</span>
                        <button onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-colors shadow-sm"
                >
                  <Paperclip size={16} />
                </button>
                <button 
                  onClick={() => setShowCompose(false)}
                  className="px-6 py-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-none font-black text-[11px] uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSend} 
                  disabled={isSending}
                  className="px-6 py-2 bg-black hover:bg-slate-900 text-white rounded-none font-black text-[11px] uppercase tracking-widest shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSending ? 'Sending...' : 'Send Message'}
                  <Send size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-md rounded-none shadow-2xl overflow-hidden flex flex-col border border-slate-100 font-sans">
              <div className="bg-black px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings size={18} />
                  <span className="font-black text-[11px] uppercase tracking-widest">Mail Server Setup</span>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-1.5 hover:bg-white/10 transition-colors"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gmail Address</label>
                  <input 
                    type="email" 
                    value={settings.GmailAddress || ''} 
                    onChange={e => setSettings({...settings, GmailAddress: e.target.value})}
                    onBlur={() => updateSetting('GmailAddress', settings.GmailAddress)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-none outline-none text-xs font-bold focus:ring-1 focus:ring-black" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gmail App Password</label>
                  <input 
                    type="password" 
                    placeholder="Enter 16-char app password"
                    value={settings.GmailAppPassword || ''} 
                    onChange={e => setSettings({...settings, GmailAppPassword: e.target.value})}
                    onBlur={() => updateSetting('GmailAppPassword', settings.GmailAppPassword)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-none outline-none text-xs font-bold focus:ring-1 focus:ring-black" 
                  />
                  <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
                    Google requires an "App Password" for CRM integration. Do not use your regular account password.
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button onClick={() => setShowSettings(false)} className="px-6 py-2 bg-black text-white text-[11px] font-black uppercase tracking-widest rounded-none shadow-md">
                  Close & Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmailPage;
