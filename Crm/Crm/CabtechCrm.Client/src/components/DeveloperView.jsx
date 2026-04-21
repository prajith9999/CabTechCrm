import React, { useState, useEffect } from 'react';
import { Shield, MessageSquare, Reply, Clock, User, AlertCircle, Terminal, Send, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import DeveloperIntegrationHub from './DeveloperIntegrationHub';

export default function DeveloperView({ API_BASE, openInfoPopup }) {
  const [activeSubTab, setActiveSubTab] = useState('tickets'); // 'tickets' | 'audit' | 'hub'
  const [tickets, setTickets] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [statusDrafts, setStatusDrafts] = useState({});

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const resp = await axios.get(`${API_BASE}/developer/helpdesk`);
      setTickets(Array.isArray(resp.data) ? resp.data : []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const resp = await axios.get(`${API_BASE}/developer/audit-logs`);
      setAuditLogs(Array.isArray(resp.data) ? resp.data : []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'tickets') fetchTickets();
    if (activeSubTab === 'audit') fetchAuditLogs();
  }, [activeSubTab]);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !replyingTo) return;

    try {
      await axios.post(`${API_BASE}/developer/helpdesk/${replyingTo}/reply`, {
        message: replyText,
        replyText: replyText
      });
      openInfoPopup('Reply Sent', 'Successfully replied to the ticket.', 'success');
      setReplyingTo(null);
      setReplyText('');
      fetchTickets();
    } catch (err) {
      openInfoPopup('Error', 'Failed to send reply.', 'error');
    }
  };

  const handleStatusUpdate = async (ticketId, status) => {
    try {
      await axios.patch(`${API_BASE}/developer/helpdesk/${ticketId}/status`, { status });
      openInfoPopup('Status Updated', `Ticket moved to ${status}.`, 'success');
      setStatusDrafts(prev => ({ ...prev, [ticketId]: status }));
      fetchTickets();
    } catch (err) {
      openInfoPopup('Status Update Failed', 'Could not update ticket status.', 'error');
    }
  };

  const unreadForDevAdmin = tickets.filter(t => t.hasUnreadForDevAdmin).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield style={{ color: '#ea580c' }} />
            <span style={{ color: '#111111' }}>Developer Control Management</span>
          </h2>
          <p className="text-slate-500 text-sm">System oversight, audit logs, and technical ticket management.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-none flex-wrap gap-1">
          <button
            onClick={() => setActiveSubTab('tickets')}
            className={`px-4 py-2 text-sm font-medium rounded-none transition-all flex items-center gap-2 ${activeSubTab === 'tickets' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={activeSubTab === 'tickets' ? { color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.25)' } : undefined}
          >
            <MessageSquare size={16} />
            All Tickets
            {unreadForDevAdmin > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-none">
                {unreadForDevAdmin}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('hub')}
            className={`px-4 py-2 text-sm font-medium rounded-none transition-all flex items-center gap-2 ${activeSubTab === 'hub' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={activeSubTab === 'hub' ? { color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.25)' } : undefined}
          >
            <Link2 size={16} />
            Mail and Shopify
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-4 py-2 text-sm font-medium rounded-none transition-all flex items-center gap-2 ${activeSubTab === 'audit' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={activeSubTab === 'audit' ? { color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.25)' } : undefined}
          >
            <Terminal size={16} />
            Audit Logs
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'hub' ? (
          <motion.div
            key="hub"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <DeveloperIntegrationHub API_BASE={API_BASE} openInfoPopup={openInfoPopup} />
          </motion.div>
        ) : activeSubTab === 'tickets' ? (
          <motion.div
            key="tickets"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {loading && tickets.length === 0 ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-none animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-none border border-slate-100 italic text-slate-400">
                No technical tickets found.
              </div>
            ) : (
              tickets.map(ticket => (
                <div key={ticket.id} className="bg-white p-6 rounded-none border border-slate-200 shadow-sm hover:border-indigo-200 transition-all">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-none">TKT-{String(ticket.id).padStart(3, '0')}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-none uppercase ${ticket.status === 'Resolved' ? 'bg-green-100 text-green-700' : ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {ticket.status}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={12} /> {new Date(ticket.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Subject</div>
                        <p className="text-slate-800 font-semibold truncate-ellipsis">{ticket.subject || 'General Issue'}</p>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Description</div>
                        <p className="text-slate-800 font-medium">{ticket.description || ticket.issueText}</p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <User size={12} /> Admin Name: <span className="font-semibold">{ticket.adminName || ticket.submittedBy}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Assigned To: <span className="font-semibold">{ticket.assignedTo || 'DevAdmin'}</span>
                      </div>
                    </div>

                    <div className="shrink-0 min-w-[220px] space-y-2">
                      <select
                        value={statusDrafts[ticket.id] || ticket.status}
                        onChange={(e) => handleStatusUpdate(ticket.id, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-none text-sm font-bold bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>

                      <button
                        onClick={() => setReplyingTo(ticket.id)}
                        className="w-full px-4 py-2.5 text-white rounded-none text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                        style={{ backgroundColor: '#111111', color: '#ffffff' }}
                      >
                        <Reply size={16} /> Reply
                      </button>

                      {ticket.status === 'Resolved' && (
                        <div className="text-green-600 flex items-center gap-1 text-xs font-medium">
                          <AlertCircle size={14} /> Resolved
                        </div>
                      )}
                    </div>
                  </div>

                  {Array.isArray(ticket.replies) && ticket.replies.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-bold text-slate-500 uppercase">Conversation</div>
                      {ticket.replies.map((r) => (
                        <div key={r.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="flex items-center gap-2 text-xs mb-1">
                            <span className={`font-bold uppercase ${r.senderRole === 'super_admin' ? 'text-indigo-700' : 'text-slate-700'}`}>
                              {r.senderRole === 'super_admin' ? 'Super Admin' : 'Admin'}
                            </span>
                            <span className="text-slate-700 font-semibold">{r.senderName}</span>
                            <span className="text-slate-400 ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-slate-700">{r.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <AnimatePresence>
                    {replyingTo === ticket.id && (
                      <motion.form
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        onSubmit={handleReply}
                        className="mt-6 space-y-3 overflow-hidden"
                      >
                        <textarea
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-none focus:ring-2 focus:ring-orange-500 outline-none text-slate-800 h-32 resize-none font-medium shadow-inner"
                        />
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => { setReplyingTo(null); setReplyText(''); }}
                            className="px-4 py-2 text-slate-500 text-sm font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={!replyText.trim()}
                            className="px-8 py-2.5 text-white rounded-none text-sm font-bold disabled:opacity-50 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                            style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
                          >
                            <Send size={14} />
                            Send Reply
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-none border border-slate-200 overflow-hidden shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Timestamp</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">User</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Action</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Entity</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">Loading logs...</td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">No audit records found.</td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">
                          {log.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-none uppercase ${
                            log.action.includes('Delete') ? 'bg-red-50 text-red-600' :
                            log.action.includes('Create') ? 'bg-green-50 text-green-600' :
                            log.action.includes('Login') ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                          {log.entityType} {log.entityId && `#${log.entityId}`}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                          {log.details}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-400">
                          {log.ipAddress || '---'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
