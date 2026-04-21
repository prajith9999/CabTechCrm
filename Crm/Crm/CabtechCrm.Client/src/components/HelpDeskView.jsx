import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, MessageSquare, Clock, ShieldCheck, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

export default function HelpDeskView({ user, openInfoPopup, API_BASE }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('submit');
  const [myTickets, setMyTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const currentUsername = user?.username || user?.Username || 'Admin';
  const operatorCode = (currentUsername || 'ADMIN').trim().replace(/\s+/g, '_').toUpperCase();
  const userRole = user?.role || user?.Role || 'Admin';
  const isDevAdmin = userRole.toLowerCase() === 'devadmin';
  const [replyDrafts, setReplyDrafts] = useState({});

  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      const resp = await axios.get(`${API_BASE}/integration/helpdesk/my`);
      const tickets = Array.isArray(resp.data) ? resp.data : [];
      setMyTickets(tickets);

      // Use correct unread flag based on user role
      const unreadFlagKey = isDevAdmin ? 'hasUnreadForDevAdmin' : 'hasUnreadForAdmin';
      const unread = tickets.filter(t => t[unreadFlagKey]);
      
      if (unread.length > 0) {
        await Promise.all(unread.map(t => axios.post(`${API_BASE}/integration/helpdesk/${t.id}/mark-read`)));
        const refreshed = await axios.get(`${API_BASE}/integration/helpdesk/my`);
        setMyTickets(Array.isArray(refreshed.data) ? refreshed.data : []);
      }
    } catch (err) {
      console.error('Error fetching my tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'my-tickets') {
      fetchMyTickets();
      const interval = setInterval(fetchMyTickets, 20000); // auto-refresh every 20s
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      openInfoPopup('Description Required', 'Please enter issue description before submitting.', 'warning');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const resp = await axios.post(`${API_BASE}/integration/helpdesk`, {
        subject: subject.trim(),
        description: description.trim(),
        issueText: description.trim()
      });
      const trace = resp?.data?.traceCode ?? resp?.data?.TraceCode;
      const msg = trace
        ? `Superb — ticket logged under cabtechadmin. Trace code: ${trace}. Operator code: ${operatorCode}. You can track it in My Issues.`
        : "Your issue was routed to the Development Team. You can track it in the 'My Issues' tab.";
      openInfoPopup('Support Ticket Created', msg, 'success');
      setSubject('');
      setDescription('');
      setIsSubmitting(false);
      setActiveTab('my-tickets');
    } catch (err) {
      const apiMsg = err?.response?.data?.message || err?.response?.data?.Message;
      openInfoPopup("Submission Failed", apiMsg || "Could not send the ticket. Please try again.", "error");
      setIsSubmitting(false);
    }
  };

  const handleReply = async (ticketId) => {
    const draft = (replyDrafts[ticketId] || '').trim();
    if (!draft) return;

    try {
      await axios.post(`${API_BASE}/integration/helpdesk/${ticketId}/reply`, { message: draft });
      openInfoPopup('Reply Added', 'Your message has been sent to Dev Admin.', 'success');
      setReplyDrafts(prev => ({ ...prev, [ticketId]: '' }));
      fetchMyTickets();
    } catch (err) {
      openInfoPopup('Reply Failed', 'Unable to send your reply right now.', 'error');
    }
  };

  const unreadCount = myTickets.filter(t => isDevAdmin ? t.hasUnreadForDevAdmin : t.hasUnreadForAdmin).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <AlertCircle className="text-indigo-600" />
            Technical Help Desk
          </h2>
          <p className="text-xs text-slate-500">Report UI bugs or technical glitches directly to developers.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-none">
          <button 
            onClick={() => setActiveTab('submit')}
            className={`px-4 py-1.5 text-sm font-bold rounded-none transition-all ${activeTab === 'submit' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'}`}
          >
            Submit Issue
          </button>
          <button 
            onClick={() => setActiveTab('my-tickets')}
            className={`px-4 py-1.5 text-sm font-bold rounded-none transition-all flex items-center gap-1 ${activeTab === 'my-tickets' ? 'bg-indigo-100 text-indigo-700 shadow-sm border border-indigo-200' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'}`}
          >
            <MessageSquare size={16} />
            {isDevAdmin ? 'All Tickets' : 'My Issues'}
            {unreadCount > 0 && <span className="w-2 h-2 bg-red-500 rounded-none animate-pulse" />}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'submit' ? (
          <motion.form
            key="submit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="bg-white p-10 rounded-none shadow-sm border border-slate-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">CabtechAdmin channel</label>
                <input
                  value="cabtechadmin"
                  readOnly
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-none text-slate-700 font-mono text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">Stamped automatically on every ticket.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Your operator code</label>
                <input
                  value={operatorCode}
                  readOnly
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-none text-slate-700 font-mono text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">Logged with your sign-in: {currentUsername}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Issue Title / Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-bold"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Describe the Technical Problem</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 transition-all resize-none h-40 font-medium"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="text-white px-8 py-3 rounded-none flex items-center gap-2 font-bold transition-all disabled:opacity-50 hover:bg-indigo-700 shadow-md"
                style={{ backgroundColor: '#4f46e5' }}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-none animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Submit Ticket
              </button>
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="my-tickets"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {loading && myTickets.length === 0 ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : myTickets.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-100 italic text-slate-400">
                {isDevAdmin ? 'No tickets have been submitted yet.' : "You haven't submitted any issues yet."}
              </div>
            ) : (
              myTickets.map(t => {
                const devReplies = Array.isArray(t.replies) ? t.replies.filter(r => r.senderRole === 'super_admin') : [];
                const adminReplies = Array.isArray(t.replies) ? t.replies.filter(r => r.senderRole !== 'super_admin') : [];
                const hasDevReply = devReplies.length > 0 || !!t.replyText;
                return (
                <div key={t.id} className={`bg-white p-6 rounded-none border shadow-sm transition-all ${t.hasUnreadForAdmin ? 'border-indigo-300 ring-4 ring-indigo-100' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-mono font-bold text-slate-400">#TKT-{String(t.id).padStart(3, '0')}</span>
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-none uppercase ${t.status === 'Open' ? 'bg-amber-100 text-amber-700' : t.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {t.status}
                      </span>
                      {t.hasUnreadForAdmin && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-none bg-indigo-600 text-white animate-pulse">New Reply</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={12} /> {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                      <button onClick={fetchMyTickets} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 transition-colors">Refresh</button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-xs text-slate-500 mb-1">Subject</div>
                    <p className="text-slate-800 text-sm font-semibold truncate-ellipsis">{t.subject || 'General Issue'}</p>
                  </div>
                  <div className="mb-4">
                    <div className="text-xs text-slate-500 mb-1">Description</div>
                    <p className="text-slate-800 text-sm font-medium">{t.description || t.issueText}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-xs">
                    <div className="bg-slate-50 rounded-md px-3 py-2 border border-slate-100">
                      <div className="text-slate-400 uppercase tracking-wide">Submitted By</div>
                      <div className="font-semibold text-slate-700">{t.adminName || t.submittedBy || currentUsername}</div>
                    </div>
                    <div className="bg-slate-50 rounded-md px-3 py-2 border border-slate-100">
                      <div className="text-slate-400 uppercase tracking-wide">Status</div>
                      <div className="font-semibold text-slate-700">{t.status}</div>
                    </div>
                    <div className="bg-slate-50 rounded-md px-3 py-2 border border-slate-100">
                      <div className="text-slate-400 uppercase tracking-wide">Developer</div>
                      <div className={`font-semibold ${hasDevReply ? 'text-indigo-600' : 'text-slate-400'}`}>{t.repliedBy || (hasDevReply ? 'Replied' : 'Pending Response')}</div>
                    </div>
                  </div>

                  {/* Developer Replies — shown prominently */}
                  {devReplies.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase mb-1">
                        <ShieldCheck size={14} className="text-indigo-600" />
                        Developer Replies
                      </div>
                      {devReplies.map((r) => (
                        <div key={r.id} className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                          <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck size={14} className="text-indigo-600" />
                            <span className="text-xs font-bold text-indigo-700">Developer — {r.senderName}</span>
                            <span className="text-[10px] text-slate-400 ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-slate-800 font-medium">"{r.message}"</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legacy single replyText (fallback if no replies array) */}
                  {!devReplies.length && t.replyText && (
                    <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck size={14} className="text-indigo-600" />
                        <span className="text-xs font-bold text-indigo-700">Developer — {t.repliedBy || 'DevAdmin'}</span>
                        {t.repliedAt && <span className="text-[10px] text-slate-400 ml-auto">{new Date(t.repliedAt).toLocaleString()}</span>}
                      </div>
                      <p className="text-sm text-slate-800 font-medium">"{t.replyText}"</p>
                    </div>
                  )}

                  {/* Admin's own messages */}
                  {adminReplies.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="text-xs font-bold text-slate-500 uppercase">Your Messages</div>
                      {adminReplies.map((r) => (
                        <div key={r.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="flex items-center gap-2 text-xs mb-1">
                            <span className="font-bold text-slate-700">You — {r.senderName}</span>
                            <span className="text-slate-400 ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-slate-700">{r.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="text-xs text-slate-500 mb-2">Reply to Developer</div>
                    <div className="flex gap-2">
                      <input
                        value={replyDrafts[t.id] || ''}
                        onChange={(e) => setReplyDrafts(prev => ({ ...prev, [t.id]: e.target.value }))}
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-none focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleReply(t.id)}
                        disabled={!(replyDrafts[t.id] || '').trim()}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-none text-sm font-bold disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all"
                      >
                        <Send size={14} />
                        Send
                      </button>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
