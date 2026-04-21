import React, { useState, useEffect, Component } from 'react';
import axios from 'axios';
import {
  BarChart3,
  Users,
  LogOut,
  Plus,
  Clock,
  CheckCircle2,
  Mail,
  FileText,
  Send,
  TrendingUp,
  Menu,
  X,
  Eye,
  EyeOff,
  BellRing,
  PieChart as PieChartIcon,
  ShoppingCart,
  Settings,
  AlertCircle,
  Shield,
  ShieldCheck,
  MessageSquare,
  ArrowRight,
  LayoutDashboard,
  History,
  ChevronRight,
  Search,
  CheckCircle,
  XCircle,
  Target,
  Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PDFViewerModal from './components/PDFViewerModal';
import IntegrationsView from './components/IntegrationsView';
import ShopifyOrdersView from './components/ShopifyOrdersView';
import HelpDeskView from './components/HelpDeskView';
import DeveloperView from './components/DeveloperView';
import ForbiddenPage from './components/ForbiddenPage';
import EmailPage from './pages/EmailPage';
import TasksPage from './pages/TasksPage';
import DeliveryView from './components/DeliveryView';
import useSignalR from './hooks/useSignalR';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';

// API Configuration
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5101/api').replace(/\/$/, '');
const AUTH_STORAGE_KEY = 'cabtech_auth';
const AUTH_SESSION_KEY = 'cabtech_auth_session';

// Error Boundary to prevent white screen crashes
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRM Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 8% 8%, #ffffff 0%, #edf3fb 42%, #dfe9f5 100%)',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ textAlign: 'center', maxWidth: 420, padding: '2rem' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>âš ï¸</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
              The application encountered an unexpected error. This may be due to a temporary API issue.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem(AUTH_STORAGE_KEY);
                sessionStorage.removeItem(AUTH_SESSION_KEY);
                window.location.reload();
              }}
              style={{
                padding: '10px 28px',
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                backgroundColor: '#111827',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer'
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const STAGES = [
  { id: 1, name: 'Email Enquiry', icon: <Mail size={16} /> },
  { id: 2, name: 'Accepted', icon: <CheckCircle2 size={16} /> },
  { id: 3, name: 'Quotation Sent', icon: <Send size={16} /> },
  { id: 4, name: 'Rejected', icon: <Clock size={16} /> },
  { id: 5, name: 'Tender Accept', icon: <FileText size={16} /> },
  { id: 6, name: 'Final Confirm', icon: <CheckCircle2 size={16} /> },
  { id: 7, name: 'Tender Received', icon: <FileText size={16} /> },
  { id: 8, name: 'Payment Done', icon: <CheckCircle2 size={16} /> },
  { id: 9, name: 'Success', icon: <TrendingUp size={16} /> }
];

const getStatusLabel = (stageId) => {
  if (stageId === 4) return 'Rejected';
  return STAGES.find((s) => s.id === stageId)?.name || 'Unknown';
};

const getStatusBadgeClass = (stageId) => {
  if (stageId === 9) return 'bg-green-100 text-green-700 border border-green-200'; // Resolved
  if (stageId === 4) return 'bg-red-50 text-red-600 border border-red-100'; // Rejected
  if (stageId === 1) return 'bg-amber-100 text-amber-700 border border-amber-200'; // Pending
  if (stageId === 5 || stageId === 6 || stageId === 7) return 'bg-blue-100 text-blue-700 border border-blue-200'; // Active
  return 'bg-slate-100 text-slate-600 border border-slate-200'; // Default
};

const NavItem = ({ active, onClick, icon, label, color, danger }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-none transition-all duration-200 group relative ${active
      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
      : danger
        ? 'text-rose-600 hover:bg-rose-50'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
  >
    <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`} style={{ color: active ? 'white' : color }}>
      {icon}
    </div>
    <span className="text-base font-bold tracking-tight">{label}</span>
    {active && (
      <motion.div
        layoutId="activePill"
        className="absolute right-3 w-1.5 h-1.5 rounded-none bg-white"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    )}
  </button>
);

const CustomerDetailsForm = ({ onSubmit }) => {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    email: "",
    company: ""
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit(formData);
      if (ok) {
        setFormData({ name: "", phoneNumber: "", email: "", company: "" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="crm-card crm-fade-up p-8 max-w-3xl">
      <h2 className="text-2xl font-bold mb-6 crm-section-title">Customer Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Customer Name</label>
          <input className="w-full px-4 py-2 border border-slate-200 rounded-lg" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Contact Number</label>
          <input
            className="w-full px-4 py-2 border border-slate-200 rounded-none"
            value={formData.phoneNumber}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, "") })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">E-mail</label>
          <input
            type="email"
            className="w-full px-4 py-2 border border-slate-200 rounded-lg"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Company Name</label>
          <input className="w-full px-4 py-2 border border-slate-200 rounded-lg" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
        </div>
      </div>
      <button onClick={handleSubmit} disabled={submitting} className="crm-btn crm-btn-primary h-10 px-4 py-2 text-sm rounded-lg disabled:opacity-60">
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </div>
  );
};

const StatCard = ({ icon, label, value, hint, onClick, color = '#34d399' }) => (
  <div
    onClick={onClick}
    className="crm-card p-6 flex flex-col justify-between h-32 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg"
    style={{ borderLeft: `4px solid ${color}` }}
  >
    <div className="flex justify-between items-start">
      <div className="p-2 rounded-none bg-slate-50 text-slate-600">
        {icon}
      </div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
    </div>
    <div className="mt-auto">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-none mb-1">{label}</div>
      {hint && <div className="text-[10px] text-slate-400 font-medium truncate opacity-80">{hint}</div>}
    </div>
  </div>
);

const DashboardGrid = ({ enquiries, closureRows, onEmailClick, onTasksClick, onOrdersClick, counts }) => {
  const wonCount = closureRows.filter(r => r.currentStage === 9).length;
  const lostCount = closureRows.filter(r => r.currentStage === 4).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          icon={<Mail size={20} />}
          label="Email Communication"
          value={counts.unreadEmails}
          hint={`${counts.totalEmails} Total Messages`}
          color="#3b82f6"
          onClick={onEmailClick}
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Pending Tasks"
          value={counts.pendingTasks}
          hint="Action items due"
          color="#f59e0b"
          onClick={onTasksClick}
        />
        <StatCard
          icon={<ShoppingCart size={20} />}
          label="Shopify Orders"
          value={counts.newShopifyOrders}
          hint={`${counts.totalShopifyOrders} Total Orders`}
          color="#10b981"
          onClick={onOrdersClick}
        />
      </div>

      <div>
        <div className="crm-card p-6 min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                <History size={18} /> Recent Closures
              </h3>
              <div className="h-0.5 w-8 bg-slate-200 mt-1"></div>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-none text-[10px] font-black border border-emerald-100 uppercase">{wonCount} Won</div>
              <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-none text-[10px] font-black border border-rose-100 uppercase">{lostCount} Lost</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100">
                <tr>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">REFERENCE</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">CUSTOMER</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 text-right">RESULT</th>
                </tr>
              </thead>
              <tbody>
                {closureRows.length > 0 ? (
                  closureRows.map(row => (
                    <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-2 text-xs font-bold text-slate-600 font-mono tracking-tighter">{row.referenceNumber}</td>
                      <td className="py-4 px-2 text-xs font-bold text-slate-900">{row.contact?.name || 'Unknown'}</td>
                      <td className="py-4 px-2 text-right">
                        <span className={`px-4 py-1.5 rounded-none text-[9px] font-black tracking-widest uppercase inline-flex items-center gap-1.5 ${row.currentStage === 9 ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-900 text-white shadow-lg shadow-slate-100'}`}>
                          {row.currentStage === 9 ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {row.currentStage === 9 ? 'WON DEAL' : 'LOST DEAL'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="py-20 text-center text-slate-300 font-bold text-xs uppercase tracking-widest">No recent closures in history</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReviewPage = ({ enquiry, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({ reason: '', futureHope: 'Yes', comments: '' });
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.reason.trim() || !formData.comments.trim()) return;
    onSubmit({ id: enquiry.id, reason: formData.reason, futureHope: formData.futureHope, comments: formData.comments });
  };
  return (
    <div className="crm-card crm-fade-up p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Quality Review</h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-900">X</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason for Rejection</label>
          <input className="w-full px-5 py-4 bg-slate-50 border-0 rounded-2xl text-sm font-bold" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detailed Analysis</label>
          <textarea rows="4" className="w-full px-5 py-4 bg-slate-50 border-0 rounded-2xl text-sm font-bold resize-none" value={formData.comments} onChange={e => setFormData({ ...formData, comments: e.target.value })} />
        </div>
        <div className="flex gap-4 pt-4">
          <button type="button" onClick={onCancel} className="flex-1 h-14 rounded-2xl text-xs font-black uppercase text-slate-400 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="flex-1 h-14 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase shadow-lg">Submit Feedback</button>
        </div>
      </form>
    </div>
  );
};

const Login = ({ onLogin, error, submitting }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="login-wrapper">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="login-card">
        <div className="login-left">
          <div className="login-brand"><div className="login-brand-logo"><img src="/logo.png" alt="Brand Logo" className="w-full h-full" /></div></div>
          <div className="login-left-content"><h1 className="login-left-title">Thank you for choosing Cabtech.<br />Powering Productivity, Driving Innovation.</h1><p className="login-left-subtitle">Experience the next generation of industrial tracking and management with our Cabtech Trading & Contracting.</p></div>
          <div className="login-site-url">www.cabtechqatar.com</div><div className="login-arrow-wrap"><motion.div animate={{ x: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} className="login-arrow-badge"><ArrowRight size={22} /></motion.div></div>
        </div>
        <div className="login-right">
          <div className="mb-10 text-center lg:text-left"><h2 className="text-4xl font-bold mb-2">Login</h2><p className="text-sm">Welcome! Login to access your dashboard.</p></div>
          <div className="space-y-6">
            {error && <div className="p-4 rounded-2xl bg-slate-100 text-slate-900 border border-slate-200"><div className="text-sm font-semibold">Couldn’t sign you in</div><div className="text-xs">{error}</div></div>}
            <div className="login-form-group"><label className="login-label">User Name</label><input className="login-input" value={username} onChange={e => setUsername(e.target.value)} /></div>
            <div className="login-form-group"><label className="login-label">Password</label><div className="relative"><input type={showPassword ? "text" : "password"} className="login-input pr-12" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !submitting) onLogin(username, password, rememberMe); }} /><button className="absolute right-4 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)} type="button">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <div className="flex items-center justify-between"><label className="remember-me"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /><span>Remember me</span></label></div>
            <button onClick={() => onLogin(username, password, rememberMe)} className="login-btn" disabled={submitting}>{submitting ? 'Signing in...' : 'Login'}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
const EditModal = ({ enquiry, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: enquiry?.title || '',
    description: enquiry?.description || ''
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 20 }} animate={{ y: 0 }}
        className="bg-white rounded-none w-full max-w-lg p-10 shadow-2xl"
      >
        <h2 className="text-2xl font-bold mb-6">Edit Enquiry Records</h2>
        <div className="space-y-6 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Enquiry Title</label>
            <input className="w-full px-5 py-4 border border-slate-100 rounded-none bg-slate-50/50 focus:ring-4 focus:ring-red-500/5" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Technical Details</label>
            <textarea className="w-full px-5 py-4 border border-slate-100 rounded-none bg-slate-50/50 focus:ring-4 focus:ring-red-500/5" rows={5} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="h-10 px-6 py-2 text-sm font-semibold rounded-none border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          {/* FIX #5: Save button that actually calls onSubmit */}
          <button
            onClick={() => onSubmit(formData)}
            className="h-10 px-6 py-2 text-sm font-semibold rounded-none"
            style={{ backgroundColor: '#111827', color: '#ffffff' }}
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const CreateModal = ({ isOpen, onClose, onSubmit, contacts, user }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contactId: '',
    source: 'Manual'
  });

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 20 }} animate={{ y: 0 }}
        className="bg-white rounded-none w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold mb-0.5 mr-2">Create New Enquiry</h2>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Digital Record Entry</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-none transition-colors text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enquiry Title</label>
            <input
              className={`w-full px-4 py-3 border rounded-none bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 outline-none font-bold text-sm ${!formData.title && formData.title !== "" ? "border-red-200" : "border-slate-100"}`}
              placeholder="e.g. Spare Parts Request..."
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Partner Association</label>
            <div className="relative">
              <select
                className={`w-full px-4 py-3 border rounded-none bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 outline-none font-bold text-sm appearance-none cursor-pointer ${!formData.contactId ? "border-red-100" : "border-slate-100"}`}
                value={formData.contactId}
                onChange={e => setFormData({ ...formData, contactId: e.target.value })}
              >
                <option value="">Select a registered contact</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.company}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <Users size={14} />
              </div>
            </div>
            {!formData.contactId && (
              <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-red-500 uppercase tracking-wider ml-1">
                <AlertCircle size={10} /> Selection required
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Technical Brief</label>
            <textarea
              className="w-full px-4 py-3 border border-slate-100 rounded-none bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 outline-none font-bold text-sm"
              rows={3}
              placeholder="Detailed description of requirements..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-5 text-[10px] font-black rounded-none border border-slate-200 text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest">
            Discard
          </button>
          <button
            onClick={() => onSubmit(formData)}
            className="h-10 px-6 text-[10px] font-black rounded-none bg-slate-900 text-white hover:bg-black transition-all shadow-lg uppercase tracking-widest"
          >
            Save Record
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const EnquiryList = ({ enquiries, onAdvance, onDelete, onEdit, onStartAccept, onStartReject, canManage, onViewPdf }) => {
  return (
    <div className="crm-table-shell crm-fade-up overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b border-slate-200" style={{ backgroundColor: '#f3f4f6' }}>
          <tr>
            <th className="px-6 py-5 text-xs font-bold text-slate-500 capitalize tracking-tight">Record</th>
            <th className="px-6 py-5 text-xs font-bold text-slate-500 capitalize tracking-tight">Identity</th>
            <th className="px-6 py-5 text-xs font-bold text-slate-500 capitalize tracking-tight">Status</th>
            <th className="px-6 py-5 text-xs font-bold text-slate-500 capitalize tracking-tight text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {enquiries.map(e => {
            const isFinalized = e.currentStage === 4 || e.currentStage === 9;
            return (
              <tr
                key={e.id}
                className={`border-b border-slate-50 last:border-0 transition-colors ${isFinalized ? 'bg-slate-100/80' : 'hover:bg-slate-50/30'}`}
              >
                <td className="px-6 py-5 min-w-[200px]">
                  <div className={`font-bold mb-0.5 flex items-center gap-2 truncate-ellipsis ${isFinalized ? 'text-slate-400' : 'text-slate-900'}`}>
                    {e.title}
                    {e.source === 'Shopify' && <span className="px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-[9px] text-emerald-700 tracking-wider shrink-0 font-bold">SHOPIFY</span>}
                    {e.source === 'Email' && <span className="px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-[9px] text-blue-700 tracking-wider shrink-0 font-bold">EMAIL</span>}
                    {e.source === 'Manual' && <span className="px-1.5 py-0.5 rounded-none border border-slate-900 bg-slate-900 text-[9px] text-white tracking-widest shrink-0 font-black uppercase shadow-sm">Enter</span>}
                  </div>
                  <div className={`text-[11px] font-mono uppercase tracking-tight truncate-ellipsis ${isFinalized ? 'text-slate-300' : 'text-slate-400'}`}>{e.referenceNumber}</div>
                </td>
                <td className="px-6 py-5 min-w-[150px]">
                  <div className={`font-bold mb-0.5 truncate-ellipsis ${isFinalized ? 'text-slate-400' : 'text-slate-900'}`}>{e.contact?.name || 'Unknown'}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] truncate-ellipsis">{e.contact?.company || 'No Company'}</div>
                </td>
                <td className="px-6 py-5">
                  <span className={`text-xs font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit ${getStatusBadgeClass(e.currentStage)}`}>
                    <span className={`w-3 h-3 rounded-full block flex-shrink-0 ${e.currentStage === 9 ? 'bg-emerald-500' : e.currentStage === 4 ? 'bg-red-500' : 'bg-amber-400'}`}></span>
                    {STAGES.find(s => s.id === e.currentStage)?.icon}
                    {getStatusLabel(e.currentStage)}
                  </span>
                </td>
                <td className="px-6 py-5">
                  <div className="flex justify-end gap-2 items-center flex-wrap">
                    {e.attachments && e.attachments.length > 0 && (
                      <button
                        onClick={() => onViewPdf(e.attachments[0].id)}
                        title="View Quote"
                        className="p-2 text-indigo-600 hover:text-indigo-900 transition-colors rounded-lg hover:bg-slate-100 flex items-center gap-1 font-bold text-xs"
                      >
                        <FileText size={16} /> VIEW PDF
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button
                          onClick={() => onEdit(e)}
                          disabled={isFinalized}
                          className="p-2 text-slate-300 hover:text-black transition-colors rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        ><FileText size={18} /></button>
                      </>
                    )}
                    {canManage && (
                      <>
                        <button
                          onClick={() => onStartAccept(e)}
                          disabled={isFinalized}
                          className="crm-btn crm-btn-success h-10 px-5 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          ACCEPT FLOW
                        </button>
                        <button
                          onClick={() => onStartReject(e)}
                          disabled={isFinalized}
                          className="crm-btn crm-btn-danger h-10 px-5 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          REJECT REVIEW
                        </button>
                      </>
                    )}
                    {!isFinalized && !canManage && (
                      <div className="text-[10px] font-bold text-slate-200 uppercase tracking-widest pr-4">Restricted</div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {enquiries.length === 0 && (
            <tr>
              <td colSpan="4" className="px-6 py-20 text-center">
                <div className="text-slate-300 font-bold text-lg mb-2 uppercase tracking-widest">Zero Matches Found</div>
                <p className="text-slate-400 text-sm">No enquiries available for the current filter.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const AnalyticsView = ({ enquiries }) => {
  const COLORS = ['#0ea5e9', '#22c55e', '#6366f1', '#f59e0b', '#ef4444', '#14b8a6', '#a855f7', '#f97316', '#06b6d4'];
  const data = STAGES.map((stage, index) => ({
    name: stage.name,
    value: enquiries.filter((e) => e.currentStage === stage.id).length,
    color: COLORS[index % COLORS.length]
  }));

  const total = enquiries.length;
  const success = enquiries.filter((e) => e.currentStage === 9).length;
  const notConfirmed = enquiries.filter((e) => e.currentStage === 4).length;
  const inProgress = enquiries.filter((e) => e.currentStage > 0 && e.currentStage < 9 && e.currentStage !== 4).length;
  const completionRate = total > 0 ? Math.round((success / total) * 100) : 0;
  const stats = [
    { label: 'Total Enquiries', value: total, color: '#0ea5e9' },
    { label: 'Success', value: success, color: '#22c55e' },
    { label: 'Not Confirmed', value: notConfirmed, color: '#ef4444' },
    { label: 'Completion', value: `${completionRate}%`, color: '#6366f1' }
  ];

  return (
    <div
      className="space-y-6"
      style={{
        padding: '1.25rem',
        borderRadius: '18px',
        border: '1px solid #dbe4f0',
        background: 'linear-gradient(180deg, #f8fbff 0%, #eef3f9 100%)'
      }}
    >
      <div
        style={{
          borderRadius: '14px',
          padding: '1rem 1.1rem',
          marginBottom: '0.75rem',
          background: 'linear-gradient(120deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
          color: '#e2e8f0',
          boxShadow: '0 12px 24px -16px rgba(15, 23, 42, 0.6)'
        }}
      >
        <div className="text-xs font-semibold uppercase" style={{ letterSpacing: '0.14em', opacity: 0.8 }}>Analytics Overview</div>
        <div className="text-xl font-bold" style={{ marginTop: '0.35rem' }}>Dashboard Performance Snapshot</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-none"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #dbe4f0',
              borderLeft: `6px solid ${item.color}`,
              padding: '1rem 1.1rem',
              boxShadow: '0 10px 20px -16px rgba(15, 23, 42, 0.45)'
            }}
          >
            <div className="text-xs font-semibold uppercase" style={{ color: '#475569', letterSpacing: '0.06em' }}>{item.label}</div>
            <div className="text-3xl font-bold" style={{ color: '#0f172a', marginTop: '0.35rem' }}>{item.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl"
          style={{ backgroundColor: '#ffffff', border: '1px solid #dbe4f0', boxShadow: '0 12px 24px -18px rgba(15, 23, 42, 0.5)' }}
        >
          <h3 className="font-bold mb-6 flex items-center gap-2" style={{ color: '#0f172a' }}><BarChart3 size={18} /> Stage Distribution</h3>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe4f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#334155' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#334155' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 8px 20px -14px rgb(15 23 42 / 0.45)' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={900}>
                  {data.map((entry, index) => (
                    <Cell key={`bar-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="p-6 rounded-2xl"
          style={{ backgroundColor: '#ffffff', border: '1px solid #dbe4f0', boxShadow: '0 12px 24px -18px rgba(15, 23, 42, 0.5)' }}
        >
          <h3 className="font-bold mb-6 flex items-center gap-2" style={{ color: '#0f172a' }}><PieChartIcon size={18} /> Workflow Split</h3>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%" cy="50%"
                  innerRadius={60}
                  outerRadius={92}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={900}
                >
                  {data.map((entry, index) => (
                    <Cell key={`pie-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}`, name]} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 8px 20px -14px rgb(15 23 42 / 0.45)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.filter((d) => d.value > 0).map((d) => (
              <div key={d.name} className="text-xs px-2 py-1 rounded-none" style={{ backgroundColor: `${d.color}22`, color: '#0f172a', border: `1px solid ${d.color}55` }}>
                {d.name}: {d.value}
              </div>
            ))}
            {inProgress >= 0 && (
              <div className="text-xs px-2 py-1 rounded-none" style={{ backgroundColor: '#33415522', color: '#0f172a', border: '1px solid #33415555' }}>
                In Progress: {inProgress}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const ContactList = ({ contacts }) => {
  return (
    <div className="crm-table-shell crm-fade-up overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Contact Name</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Company</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Phone</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Added On</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map(c => (
            <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
              <td className="px-6 py-4 font-semibold">{c.name}</td>
              <td className="px-6 py-4 text-sm">{c.company || '-'}</td>
              <td className="px-6 py-4 text-sm">{c.phoneNumber || '-'}</td>
              <td className="px-6 py-4 text-right text-xs text-slate-400">
                {new Date(c.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {contacts.length === 0 && (
            <tr>
              <td colSpan="5" className="px-6 py-16 text-center">
                <div className="text-slate-300 font-bold mb-1 uppercase tracking-tighter">No Contacts Found</div>
                <div className="text-xs text-slate-400">Search returned no results in this category.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const ReportView = ({ contacts, enquiries, onTenderConfirmed, onAskSuccess, onAskReject, onAcceptReport, canManage }) => (
  <div className="space-y-6">
    <div className="crm-card crm-fade-up p-6">
      <h2 className="text-xl font-bold mb-4 crm-section-title">Report Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 crm-card-soft">
          <div className="text-xs uppercase text-slate-500">Total Customers</div>
          <div className="text-2xl font-bold">{contacts.length}</div>
        </div>
        <div className="p-4 crm-card-soft">
          <div className="text-xs uppercase text-slate-500">Total Enquiries</div>
          <div className="text-2xl font-bold">{enquiries.length}</div>
        </div>
        <div className="p-4 crm-card-soft">
          <div className="text-xs uppercase text-slate-500">Completed</div>
          <div className="text-2xl font-bold">{enquiries.filter((e) => e.currentStage >= 9).length}</div>
        </div>
      </div>
    </div>
    <div className="crm-table-shell crm-fade-up">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Reference</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Customer</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Source</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Order status</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Current Status</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Report Actions</th>
          </tr>
        </thead>
        <tbody>
          {enquiries.map((e) => (
            <tr key={e.id} className="border-b border-slate-100 last:border-0">
              <td className="px-6 py-4 truncate-ellipsis">{e.referenceNumber}</td>
              <td className="px-6 py-4 truncate-ellipsis">{e.contact?.name || '-'}</td>
              <td className="px-6 py-4 text-xs font-semibold text-slate-600">{(e.source || 'Manual')}</td>
              <td className="px-6 py-4 text-xs text-slate-600 max-w-[200px]">
                {e.shopifyOrder ? (
                  <span>Pay: {e.shopifyOrder.paymentStatus || 'â€”'} Â· Ship: {e.shopifyOrder.fulfillmentStatus || 'â€”'}</span>
                ) : (
                  <span className="text-slate-400">â€”</span>
                )}
              </td>
              <td className="px-6 py-4">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${getStatusBadgeClass(e.currentStage)}`}>
                  {getStatusLabel(e.currentStage)}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-end gap-2 flex-wrap">
                  {canManage && e.currentStage === 1 && (
                    <button
                      type="button"
                      onClick={() => onAcceptReport(e.id)}
                      className="crm-btn h-9 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      ACCEPT
                    </button>
                  )}
                  {/* FIX #3: Tender Confirmed only in tender stages */}
                  {canManage && (e.currentStage === 5 || e.currentStage === 6 || e.currentStage === 7) && (
                    <button
                      onClick={() => onTenderConfirmed(e.id)}
                      className="crm-btn crm-btn-success h-9 px-4 rounded-lg text-[10px] font-bold whitespace-nowrap"
                    >
                      TENDER CONFIRMED
                    </button>
                  )}
                  {/* FIX #3: Ask Success only if not already finalized */}
                  {canManage && e.currentStage !== 9 && e.currentStage !== 4 && (
                    <button
                      onClick={() => onAskSuccess(e.id)}
                      className="crm-btn crm-btn-primary h-9 px-4 rounded-lg text-[10px] font-bold whitespace-nowrap"
                    >
                      ASK SUCCESS
                    </button>
                  )}
                  {/* FIX #3: Ask Reject only if not already finalized */}
                  {canManage && e.currentStage !== 4 && e.currentStage !== 9 && (
                    <button
                      onClick={() => onAskReject(e.id)}
                      className="crm-btn crm-btn-danger h-9 px-4 rounded-lg text-[10px] font-bold whitespace-nowrap"
                    >
                      ASK REJECT
                    </button>
                  )}
                  {/* Show locked badge for finalized records */}
                  {(e.currentStage === 4 || e.currentStage === 9) && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                      {e.currentStage === 9 ? 'âœ“ Success' : 'âœ— Rejected'}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {enquiries.length === 0 && (
            <tr>
              <td colSpan="6" className="px-6 py-16 text-center">
                <div className="text-slate-300 font-bold mb-1 uppercase">No matches for report</div>
                <div className="text-xs text-slate-400">Try a different search term.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const TenderRejectModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    reason: '',
    futureHope: 'Yes',
    comments: ''
  });
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({ reason: '', futureHope: 'Yes', comments: '' });
      setLocalError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!formData.reason.trim() || !formData.comments.trim()) {
      setLocalError('Reason and additional comments are required.');
      return;
    }
    setLocalError('');
    onSubmit(formData);
  };

  const canSubmit = formData.reason.trim() && formData.comments.trim();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Tender Rejection</h2>
              <div className="h-1 w-12 bg-red-500 rounded-full mt-1"></div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <LogOut size={20} className="text-slate-400 rotate-180" />
            </button>
          </div>

          <div className="space-y-6">
            {localError ? (
              <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{localError}</div>
            ) : null}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Reason for Rejection</label>
              <input
                type="text"
                className="w-full h-14 bg-slate-50 border-0 rounded-2xl px-5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Any Hope in Future?</label>
              <div className="flex bg-slate-50 p-1.5 rounded-2xl gap-2">
                {['Yes', 'No'].map(option => (
                  <button
                    key={option}
                    onClick={() => setFormData({ ...formData, futureHope: option })}
                    className={`flex-1 h-11 rounded-xl text-xs font-black uppercase transition-all ${formData.futureHope === option ? 'bg-white shadow-md text-red-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Additional Comments</label>
              <textarea
                rows="4"
                className="w-full bg-slate-50 border-0 rounded-2xl p-5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none"
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-4 mt-10">
            <button onClick={onClose} className="flex-1 h-14 rounded-none text-xs font-black uppercase text-slate-400 hover:bg-slate-50 transition-all">Cancel</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 h-14 bg-slate-900 text-white rounded-none text-xs font-black uppercase shadow-lg shadow-slate-200 hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const LeadsToolView = ({ contacts, enquiries }) => (
  <div className="space-y-6">
    <div className="crm-card crm-fade-up p-6">
      <h2 className="text-xl font-bold mb-4 crm-section-title">Leads</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 crm-card-soft">
          <div className="text-xs uppercase text-slate-500">Total Leads</div>
          <div className="text-2xl font-bold">{contacts.length}</div>
        </div>
        <div className="p-4 crm-card-soft">
          <div className="text-xs uppercase text-slate-500">Leads With Enquiries</div>
          <div className="text-2xl font-bold">{contacts.filter((c) => enquiries.some((e) => e.contact?.id === c.id)).length}</div>
        </div>
        <div className="p-4 crm-card-soft">
          <div className="text-xs uppercase text-slate-500">New Contacts</div>
          <div className="text-2xl font-bold">{contacts.filter((c) => {
            const created = new Date(c.createdAt || Date.now());
            return Date.now() - created.getTime() < 1000 * 60 * 60 * 24 * 7;
          }).length}</div>
        </div>
      </div>
    </div>
    <div className="crm-table-shell crm-fade-up overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Lead Name</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Company</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Phone</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Email</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-b border-slate-100 last:border-0">
              <td className="px-6 py-4 font-semibold">{c.name}</td>
              <td className="px-6 py-4">{c.company || '-'}</td>
              <td className="px-6 py-4">{c.phoneNumber || '-'}</td>
              <td className="px-6 py-4">{c.email || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const OpportunitiesToolView = ({ enquiries }) => (
  <div className="space-y-6">
    <div className="crm-card crm-fade-up p-6">
      <h2 className="text-xl font-bold mb-4 crm-section-title">Opportunities</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 crm-card-soft">
          <div className="text-xs uppercase text-slate-500">Open Opportunities</div>
          <div className="text-2xl font-bold">{enquiries.filter((e) => e.currentStage < 9).length}</div>
        </div>
        <div className="p-4 crm-card-soft">
          <div className="text-xs uppercase text-slate-500">Won</div>
          <div className="text-2xl font-bold">{enquiries.filter((e) => e.currentStage === 9).length}</div>
        </div>
        <div className="p-4 crm-card-soft">
          <div className="text-xs uppercase text-slate-500">Not Confirmed</div>
          <div className="text-2xl font-bold">{enquiries.filter((e) => e.currentStage === 4).length}</div>
        </div>
      </div>
    </div>
    <div className="crm-table-shell crm-fade-up overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Opportunity</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Customer</th>
            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Stage</th>
          </tr>
        </thead>
        <tbody>
          {enquiries.map((e) => (
            <tr key={e.id} className="border-b border-slate-100 last:border-0">
              <td className="px-6 py-4 font-semibold">{e.title}</td>
              <td className="px-6 py-4">{e.contact?.name || '-'}</td>
              <td className="px-6 py-4">{getStatusLabel(e.currentStage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const FollowUpsToolView = ({ enquiries }) => {
  // FIX #8: Exclude rejected (stage 4) from follow-ups â€” they are closed, not pending
  const followUps = enquiries.filter((e) => e.currentStage !== 9 && e.currentStage !== 4);

  return (
    <div className="space-y-6">
      <div className="crm-card crm-fade-up p-6">
        <h2 className="text-xl font-bold mb-2 crm-section-title">Follow-Ups</h2>
        <p className="text-sm crm-subtitle">Track pending enquiries that need action.</p>
      </div>
      <div className="crm-table-shell crm-fade-up overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Reference</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Customer</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Current Stage</th>
            </tr>
          </thead>
          <tbody>
            {followUps.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 last:border-0">
                <td className="px-6 py-4">{e.referenceNumber}</td>
                <td className="px-6 py-4">{e.contact?.name || '-'}</td>
                <td className="px-6 py-4">{getStatusLabel(e.currentStage)}</td>
              </tr>
            ))}
            {followUps.length === 0 && (
              <tr>
                <td colSpan="3" className="px-6 py-16 text-center text-slate-400">No pending follow-ups.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ActionPopup = ({ title, message, variant, showConfirm, confirmText, onConfirm, onClose }) => {
  useEffect(() => {
    if (showConfirm) return;
    const timer = setTimeout(() => {
      onClose();
    }, 2000);
    return () => clearTimeout(timer);
  }, [showConfirm, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 action-popup-overlay"
    >
      <motion.div
        initial={{ y: 20, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 20, scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="action-popup-container w-full"
        style={{ maxWidth: '420px' }}
      >
        <div style={{ padding: '32px 28px 24px' }}>
          <div className={`action-popup-icon ${variant}`}>
            {variant === 'error' ? '!' : variant === 'warning' ? '⚠' : variant === 'success' ? '✓' : 'i'}
          </div>
          <h3 className="action-popup-title">{title}</h3>
          <p className="action-popup-message">{message}</p>
          <div className="action-popup-buttons">
            {showConfirm && (
              <button
                onClick={onConfirm}
                className="action-popup-btn action-popup-btn-primary"
              >
                {confirmText}
              </button>
            )}
            <button
              onClick={onClose}
              className="action-popup-btn action-popup-btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SearchResults = ({ results, searchTerm, onCreateNew, onClose, onNavigate }) => {
  if (!searchTerm) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl z-[100] max-h-[420px] overflow-y-auto rounded-none"
      style={{ boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)' }}
    >
      <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Results</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="divide-y divide-slate-50">
        {results.length > 0 ? (
          results.map((res, i) => (
            <button
              key={`${res.type}-${res.id}-${i}`}
              onClick={() => onNavigate(res.type === 'enquiry' ? 'enquiries' : 'contacts')}
              className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-4 transition-colors group"
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-none shrink-0 ${res.type === 'enquiry' ? 'bg-amber-50 text-amber-600' : 'bg-cyan-50 text-cyan-600'}`}>
                {res.type === 'enquiry' ? <Clock size={16} /> : <Users size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 truncate block text-xs">{res.title}</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter shrink-0">{res.type}</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5 tracking-tight">{res.subtitle}</div>
              </div>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-600 transition-all group-hover:translate-x-1" />
            </button>
          ))
        ) : (
          <div className="p-10 text-center">
            <div className="text-slate-300 mb-2 flex justify-center"><Search size={32} /></div>
            <p className="text-xs text-slate-400 font-medium tracking-tight">No records found matching "{searchTerm}"</p>
          </div>
        )}
      </div>

      <button
        onClick={onCreateNew}
        className="w-full p-4 bg-slate-900 text-white flex items-center justify-center gap-2 hover:bg-black transition-colors"
      >
        <Plus size={16} />
        <span className="text-[10px] font-black uppercase tracking-widest">Create New Record</span>
      </button>
    </motion.div>
  );
};

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!saved) return false;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.token) {
        axios.defaults.headers.common.Authorization = `Bearer ${parsed.token}`;
        return true;
      }
    } catch {
      return false;
    }
    return false;
  });
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [enquiries, setEnquiries] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [enquiryStageFilter, setEnquiryStageFilter] = useState('Active'); // New state for filtering enquiries tab
  const [contactsSubTab, setContactsSubTab] = useState('All Contacts');
  const [selectedYear, setSelectedYear] = useState('All'); // Global history filter state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [isRejectReportModalOpen, setIsRejectReportModalOpen] = useState(false);
  const [rejectReportId, setRejectReportId] = useState(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState(null);
  const [workflowEnquiry, setWorkflowEnquiry] = useState(null);
  const [reviewEnquiry, setReviewEnquiry] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewingAttachmentId, setViewingAttachmentId] = useState(null);
  const [popup, setPopup] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
    showConfirm: false,
    confirmText: 'Submit',
    onConfirm: null
  });
  const [counts, setCounts] = useState({
    totalEmails: 0,
    unreadEmails: 0,
    pendingTasks: 0,
    newShopifyOrders: 0,
    totalShopifyOrders: 0
  });
  const [notifications, setNotifications] = useState([]);
  const [emailRefreshToken, setEmailRefreshToken] = useState(0);
  const [tasksRefreshToken, setTasksRefreshToken] = useState(0);

  const safeEnquiries = Array.isArray(enquiries) ? enquiries : [];
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const notAcceptedCount = safeEnquiries.filter(e => e.currentStage === 1).length;

  const isElevatedUser = user?.role === 'SuperAdmin' || user?.role === 'DevAdmin';
  const isSuperAdminOnly = user?.role === 'SuperAdmin';
  const isDevAdmin = user?.role === 'DevAdmin';
  const isAdmin = user?.role === 'Admin';
  const isUser = user?.role === 'User';
  const canManage = isElevatedUser || isAdmin;
  const canAccessElevatedTools = isElevatedUser;

  const mobileNumberRegex = /^[0-9]+$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const openInfoPopup = (title, message, variant = 'success') => {
    setPopup({
      isOpen: true,
      title,
      message,
      variant,
      showConfirm: false,
      confirmText: 'Submit',
      onConfirm: null
    });
  };

  const openConfirmPopup = ({ title, message, variant = 'info', confirmText = 'Submit', onConfirm }) => {
    setPopup({
      isOpen: true,
      title,
      message,
      variant,
      showConfirm: true,
      confirmText,
      onConfirm
    });
  };

  const closePopup = () => {
    setPopup((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  const handlePopupConfirm = async () => {
    if (popup.onConfirm) {
      await popup.onConfirm();
    }
    closePopup();
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    delete axios.defaults.headers.common.Authorization;
    setIsLoggedIn(false);
    setUser(null);
    setActiveTab('dashboard');
    setIsSidebarOpen(false);
  };

  const fetchCounts = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/Core/notifications/counts`);
      const d = resp.data || {};
      setCounts({
        totalEmails: d.totalEmails ?? 0,
        unreadEmails: d.unreadEmails ?? 0,
        pendingTasks: d.pendingTasks ?? 0,
        newShopifyOrders: d.newShopifyOrders ?? 0,
        totalShopifyOrders: d.totalShopifyOrders ?? 0
      });
    } catch (err) {
      console.error('Error fetching notification counts:', err);
    }
  };

  const signalRToken = (user?.token || user?.Token || '').trim();

  useSignalR(
    `${API_BASE.replace('/api', '')}/hubs/notifications`,
    (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 5));
      fetchCounts();
      const t = notification?.type ?? notification?.Type;
      
      // Real-time Toast Notification
      if (t === 'Email' || t === 'Shopify') {
        openInfoPopup(
          `New ${t}`, 
          notification?.message ?? notification?.Message ?? `A new ${t.toLowerCase()} enquiry has arrived.`,
          'success'
        );
      }

      if (t === 'Email') setEmailRefreshToken((x) => x + 1);
      if (t === 'Shopify' || t === 'Task') setTasksRefreshToken((x) => x + 1);
    },
    signalRToken,
    isLoggedIn && !!signalRToken
  );

  useEffect(() => {
    if (isLoggedIn) {
      fetchCounts();
    }
  }, [isLoggedIn, activeTab]);

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    const intervalId = setInterval(() => {
      fetchCounts();
    }, 60000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchCounts();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isLoggedIn]);

  const validateSessionToken = async (token) => {
    try {
      const resp = await axios.get(`${API_BASE}/auth/validate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return resp?.data?.success === true;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) return false;
      return true;
    }
  };

  // Login handler
  const handleLogin = async (username, password, rememberMe) => {
    if (loginSubmitting) return;
    setLoginError('');
    setLoginSubmitting(true);
    try {
      const cleanedUsername = (username || '').trim();
      const response = await axios.post(`${API_BASE}/auth/login`, { username: cleanedUsername, password });
      const success = response?.data?.success ?? response?.data?.Success;
      const token = response?.data?.token ?? response?.data?.Token;
      const role = response?.data?.role ?? response?.data?.Role;

      if (success && token) {
        const session = { username: cleanedUsername, token, role };
        if (rememberMe) {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
          sessionStorage.removeItem(AUTH_SESSION_KEY);
        } else {
          sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
        axios.defaults.headers.common.Authorization = `Bearer ${session.token}`;
        setIsLoggedIn(true);
        setUser(session);
        fetchEnquiries();
        fetchContacts();
        return;
      }

      setLoginError('Login response was invalid. Please try again.');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setLoginError('Invalid credentials. Please try again.');
      } else {
        setLoginError('Backend is unreachable. Please ensure API is running on http://localhost:5101.');
      }
    } finally {
      setLoginSubmitting(false);
    }
  };

  const fetchEnquiries = async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE}/enquiries`);
      setEnquiries(Array.isArray(resp.data) ? resp.data : []);
    } catch (err) {
      console.error('Error fetching enquiries:', err);
      setEnquiries([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/enquiries/contacts`);
      setContacts(Array.isArray(resp.data) ? resp.data : []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setContacts([]);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const validateAuth = async () => {
      try {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
        if (!saved) {
          setAuthReady(true);
          return;
        }

        const parsed = JSON.parse(saved);
        if (!parsed?.token) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          sessionStorage.removeItem(AUTH_SESSION_KEY);
          setIsLoggedIn(false);
          setUser(null);
          setAuthReady(true);
          return;
        }

        // FIX #2: Check JWT expiry client-side before making a network call
        try {
          const payloadBase64 = parsed.token.split('.')[1];
          if (payloadBase64) {
            const payload = JSON.parse(atob(payloadBase64));
            if (payload.exp && Date.now() > payload.exp * 1000) {
              localStorage.removeItem(AUTH_STORAGE_KEY);
              sessionStorage.removeItem(AUTH_SESSION_KEY);
              setIsLoggedIn(false);
              setUser(null);
              setAuthReady(true);
              return;
            }
          }
        } catch {
          // Malformed token — clear and fall through to server validation
        }

        // Background server validation
        const valid = await validateSessionToken(parsed.token);
        if (!valid) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          sessionStorage.removeItem(AUTH_SESSION_KEY);
          delete axios.defaults.headers.common.Authorization;
          setIsLoggedIn(false);
          setUser(null);
        } else {
          // Token is good, ensure state matches
          if (!cancelled) {
            axios.defaults.headers.common.Authorization = `Bearer ${parsed.token}`;
            setUser(parsed);
            setIsLoggedIn(true);
            fetchEnquiries();
            fetchContacts();
          }
        }
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        setIsLoggedIn(false);
        setUser(null);
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    };

    validateAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const advanceStage = async (id, currentStage) => {
    if (currentStage >= 9) return;
    // FIX #9: Stage 4 = Rejected — only reachable via the explicit Reject Workflow, never via Advance
    const nextStage = currentStage === 3 ? 5 : currentStage + 1;
    try {
      await axios.post(`${API_BASE}/enquiries/${id}/stage`, {
        stageId: nextStage,
        comments: `Advanced to ${STAGES.find(s => s.id === nextStage)?.name || 'Next Stage'}`,
        updatedBy: user?.username || 'Admin'
      });
      await fetchEnquiries();
      openInfoPopup('Stage Advanced', `Successfully moved to ${STAGES.find(s => s.id === nextStage)?.name || 'the next stage'}.`, 'success');
    } catch (err) {
      console.error('Error advancing stage:', err);
      openInfoPopup('Error', 'Unable to advance stage right now. Please check connection.', 'error');
    }
  };

  const createEnquiry = async (formData) => {
    if (!formData.name?.trim() || !formData.phoneNumber?.trim() || !formData.company?.trim() || !formData.email?.trim() || !formData.title?.trim() || !formData.description?.trim()) {
      openInfoPopup('Validation Error', 'Please fill all required details before submit.', 'error');
      return false;
    }
    if (!mobileNumberRegex.test(formData.phoneNumber.trim())) {
      openInfoPopup('Validation Error', 'Mobile number must contain numbers only.', 'error');
      return false;
    }
    if (!emailRegex.test(formData.email.trim())) {
      openInfoPopup('Validation Error', 'Please enter a valid email address.', 'error');
      return false;
    }
    try {
      const payload = {
        ...formData
      };
      await axios.post(`${API_BASE}/enquiries`, payload);
      setIsModalOpen(false);
      openInfoPopup('Success', 'You have submitted successfully.', 'success');
      fetchEnquiries();
      fetchContacts();
      setActiveTab('enquiries');
      return true;
    } catch (err) {
      console.error('Error creating enquiry:', err);
      openInfoPopup('Error', 'Unable to create enquiry right now.', 'error');
      return false;
    }
  };

  const createNewEnquiry = async (formData) => {
    if (!formData.title?.trim() || !formData.contactId) {
      openInfoPopup('Validation Error', 'Please select a contact and enter a title.', 'warning');
      return;
    }
    try {
      await axios.post(`${API_BASE}/enquiries`, {
        title: formData.title.trim(),
        description: formData.description?.trim() || '',
        contactId: parseInt(formData.contactId, 10),
        source: 'Manual',
        updatedBy: user?.username || 'Admin'
      });
      setIsModalOpen(false);
      openInfoPopup('Success', 'New enquiry record created successfully.', 'success');
      fetchEnquiries();
      setActiveTab('enquiries');
    } catch (err) {
      console.error('Error creating new enquiry:', err);
      openInfoPopup('Error', 'Unable to create enquiry at this time.', 'error');
    }
  };

  const submitEnquiryDecision = async (id, decision) => {
    const isAccepted = decision === 'accept';
    const stageId = isAccepted ? 2 : 4;
    const comments = isAccepted ? 'Accepted by user submit' : 'Not accepted by user submit';
    try {
      await axios.post(`${API_BASE}/enquiries/${id}/stage`, {
        stageId,
        comments,
        updatedBy: user?.username || 'Admin'
      });
      await fetchEnquiries();
      openInfoPopup('Success', 'You have submitted successfully.', isAccepted ? 'success' : 'error');
    } catch (err) {
      console.error('Error submitting decision:', err);
      openInfoPopup('Error', 'Unable to submit decision right now.', 'error');
    }
  };

  const requestEnquiryDecision = (id, decision) => {
    const isAccepted = decision === 'accept';
    openConfirmPopup({
      title: isAccepted ? 'Submit Acceptance?' : 'Submit Rejection?',
      message: isAccepted ? 'This enquiry will be marked as Accepted.' : 'This enquiry will be marked as Not Accept.',
      variant: isAccepted ? 'success' : 'error',
      confirmText: 'Submit',
      onConfirm: async () => submitEnquiryDecision(id, decision)
    });
  };

  const startAcceptWorkflow = (enquiry) => {
    setWorkflowEnquiry(enquiry);
    setIsWorkflowModalOpen(true);
  };

  const sendWorkflowQuestion = async (enquiryId, question) => {
    try {
      await axios.post(`${API_BASE}/enquiries/${enquiryId}/workflow/question`, {
        question,
        updatedBy: user?.username || 'Admin'
      });
      await fetchEnquiries();
    } catch (err) {
      console.error('Error sending workflow question:', err);
      openInfoPopup('Error', 'Unable to save/send question right now.', 'error');
      throw err;
    }
  };

  const trackWorkflowReply = async (enquiryId, replyReceived) => {
    try {
      await axios.post(`${API_BASE}/enquiries/${enquiryId}/workflow/reply`, {
        replyReceived,
        updatedBy: user?.username || 'Admin'
      });
      await fetchEnquiries();
    } catch (err) {
      console.error('Error tracking workflow reply:', err);
      openInfoPopup('Error', 'Unable to save reply status right now.', 'error');
      throw err;
    }
  };

  const finalizeWorkflow = async (enquiryId, acceptResponse) => {
    try {
      await axios.post(`${API_BASE}/enquiries/${enquiryId}/workflow/final`, {
        acceptResponse,
        updatedBy: user?.username || 'Admin'
      });
      await fetchEnquiries();
      setActiveTab('dashboard');
      openInfoPopup('Success', 'Workflow submitted and dashboard updated.', 'success');
    } catch (err) {
      console.error('Error finalizing workflow:', err);
      openInfoPopup('Error', 'Unable to finalize workflow right now.', 'error');
      throw err;
    }
  };

  const startRejectWorkflow = (enquiry) => {
    setReviewEnquiry(enquiry);
    setActiveTab('review');
  };

  const submitRejectReview = async (comment) => {
    if (!reviewEnquiry?.id) return;
    await axios.post(`${API_BASE}/enquiries/${reviewEnquiry.id}/workflow/reject`, {
      comment,
      updatedBy: user?.username || 'Admin'
    });
    await fetchEnquiries();
    openInfoPopup('Saved', 'Review submitted and status updated to Rejected.', 'success');
    setReviewEnquiry(null);
    setActiveTab('dashboard');
  };

  const markTenderConfirmed = async (id) => {
    try {
      await axios.post(`${API_BASE}/enquiries/${id}/stage`, {
        stageId: 6,
        comments: 'Tender confirmed from report section',
        updatedBy: user?.username || 'Admin'
      });
      await fetchEnquiries();
      openInfoPopup('Success', 'Tender confirmed.', 'success');
    } catch (err) {
      console.error('Error confirming tender:', err);
      openInfoPopup('Error', 'Unable to confirm tender right now.', 'error');
    }
  };

  const requestTenderConfirmed = (id) => {
    openConfirmPopup({
      title: 'Confirm Tender?',
      message: 'Do you want to mark this enquiry as Tender Confirmed?',
      variant: 'warning',
      confirmText: 'Submit',
      onConfirm: async () => markTenderConfirmed(id)
    });
  };

  const askSuccess = async (id) => {
    try {
      await axios.post(`${API_BASE}/enquiries/${id}/stage`, {
        stageId: 9,
        comments: 'Marked success from report section',
        updatedBy: user?.username || 'Admin'
      });
      await fetchEnquiries();
      openInfoPopup('Superb!', 'Well done on closing this deal! Keep it up!', 'success');
    } catch (err) {
      console.error('Error marking success:', err);
      openInfoPopup('Error', 'Unable to mark success right now.', 'error');
    }
  };

  const requestAskSuccess = (id) => {
    openConfirmPopup({
      title: 'Mark as Success?',
      message: 'Do you want to complete this transaction?',
      variant: 'success',
      confirmText: 'Submit',
      onConfirm: async () => askSuccess(id)
    });
  };

  const requestAcceptFromReport = (id) => {
    openConfirmPopup({
      title: 'Accept this record?',
      message: 'This enquiry moves to Accepted. You can continue processing from the Enquiries board.',
      variant: 'success',
      confirmText: 'Accept',
      onConfirm: async () => submitEnquiryDecision(id, 'accept')
    });
  };

  const submitDetailedRejection = async (id, data) => {
    if (!id) {
      openInfoPopup('Missing record', 'Select an enquiry on the Report page, then open Reject again.', 'error');
      return;
    }
    if (!data?.reason?.trim() || !data?.comments?.trim()) {
      openInfoPopup('Form incomplete', 'Reason and additional comments are required before submit.', 'warning');
      return;
    }
    try {
      await axios.post(`${API_BASE}/enquiries/${id}/workflow/reject`, {
        comment: data.comments.trim(),
        reason: data.reason.trim(),
        futureHope: data.futureHope === 'Yes',
        updatedBy: user?.username || 'Admin'
      });
      await fetchEnquiries();
      setIsRejectReportModalOpen(false);
      setRejectReportId(null);
      setActiveTab('dashboard');
      openInfoPopup('Noted', "Don't worry, we can try another. Keep pushing!", 'info');
    } catch (err) {
      console.error('Error submitting rejection:', err);
      openInfoPopup('Error', 'Unable to process rejection right now.', 'error');
    }
  };

  const deleteEnquiry = async (id) => {
    try {
      await axios.delete(`${API_BASE}/enquiries/${id}`);
      fetchEnquiries();
      fetchContacts();
    } catch (err) {
      console.error('Error deleting enquiry:', err);
      openInfoPopup('Error', 'Unable to delete enquiry right now.', 'error');
    }
  };

  // FIX #4: Delete confirmation before permanent removal
  const requestDeleteEnquiry = (id) => {
    openConfirmPopup({
      title: 'Delete Enquiry?',
      message: 'This will permanently delete this record and all its history. This cannot be undone.',
      variant: 'error',
      confirmText: 'Delete',
      onConfirm: async () => deleteEnquiry(id)
    });
  };

  const updateEnquiry = async (formData) => {
    if (!editingEnquiry?.id) return;
    try {
      await axios.put(`${API_BASE}/enquiries/${editingEnquiry.id}`, formData);
      setIsEditModalOpen(false);
      setEditingEnquiry(null);
      fetchEnquiries();
    } catch (err) {
      console.error('Error updating enquiry:', err);
      openInfoPopup('Error', 'Unable to update enquiry right now.', 'error');
    }
  };

  const createCustomerDetails = async (formData) => {
    if (!formData.name?.trim() || !formData.phoneNumber?.trim() || !formData.email?.trim() || !formData.company?.trim()) {
      openInfoPopup('Validation Error', 'Please fill all required details before submit.', 'error');
      return false;
    }
    if (!mobileNumberRegex.test(formData.phoneNumber.trim())) {
      openInfoPopup('Validation Error', 'Mobile number must contain numbers only.', 'error');
      return false;
    }
    if (!emailRegex.test(formData.email.trim())) {
      openInfoPopup('Validation Error', 'Please enter a valid email address.', 'error');
      return false;
    }
    try {
      const response = await axios.post(`${API_BASE}/enquiries/contacts`, formData);
      const created = {
        id: response?.data?.id ?? Date.now(),
        name: formData.name,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        company: formData.company,
        createdAt: new Date().toISOString()
      };
      setContacts((prev) => [created, ...prev]);
      await fetchContacts();
      await fetchEnquiries();
      openInfoPopup('Success', 'Customer saved. A new enquiry was added to Enquiries for this lead.', 'success');
      setActiveTab('enquiries');
      return true;
    } catch (err) {
      console.error('Error creating customer details:', err);
      openInfoPopup('Error', 'Unable to save customer details right now.', 'error');
      return false;
    }
  };

  if (!authReady || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <img src="/logo.png" alt="Cabtech" className="h-12 w-auto mb-8 opacity-90" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                className="w-2 h-2 bg-slate-900 rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24 }}>
          <Login onLogin={handleLogin} error={loginError} submitting={loginSubmitting} />
        </motion.div>
      </ErrorBoundary>
    );
  }



  const filteredEnquiries = safeEnquiries.filter(e => {
    const searchString = (searchTerm || '').toLowerCase();

    // Global Year Filter
    if (selectedYear !== 'All') {
      const dateStr = e.createdAt || e.CreatedAt || e.updatedAt || e.UpdatedAt;
      if (dateStr) {
        const year = new Date(dateStr).getFullYear().toString();
        if (year !== selectedYear) return false;
      }
    }

    return (
      (e.title || '').toLowerCase().includes(searchString) ||
      (e.contact?.name || '').toLowerCase().includes(searchString) ||
      (e.contact?.phoneNumber || '').toLowerCase().includes(searchString) ||
      (e.contact?.email || '').toLowerCase().includes(searchString) ||
      (e.contact?.company || '').toLowerCase().includes(searchString) ||
      (e.referenceNumber || '').toLowerCase().includes(searchString) ||
      (STAGES.find(s => s.id === e.currentStage)?.name || '').toLowerCase().includes(searchString)
    );
  });

  const filteredContacts = safeContacts.filter(c => {
    const searchString = (searchTerm || '').toLowerCase();

    // Global Year Filter
    if (selectedYear !== 'All') {
      const dateStr = c.createdAt || c.CreatedAt || c.updatedAt || c.UpdatedAt;
      if (dateStr) {
        const year = new Date(dateStr).getFullYear().toString();
        if (year !== selectedYear) return false;
      }
    }

    return (
      (c.name || '').toLowerCase().includes(searchString) ||
      (c.company || '').toLowerCase().includes(searchString) ||
      (c.email || '').toLowerCase().includes(searchString) ||
      (c.phoneNumber || '').toLowerCase().includes(searchString)
    );
  });

  const handleCreateFromSearch = () => {
    setEditingEnquiry({ title: searchTerm, description: '' });
    setIsModalOpen(true);
    setShowSearchDropdown(false);
  };

  const allResults = [
    ...filteredEnquiries.map(e => ({
      type: 'enquiry',
      id: e.id,
      title: e.title || 'Untitled Enquiry',
      subtitle: e.referenceNumber || 'No Reference',
      data: e
    })),
    ...filteredContacts.map(c => ({
      type: 'contact',
      id: c.id,
      title: c.name || 'Unnamed Contact',
      subtitle: c.company || 'No Company',
      data: c
    }))
  ];

  const selectSidebarTab = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  return (
    <ErrorBoundary>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="flex min-h-screen relative"
        style={{ backgroundColor: 'var(--bg)', height: '100vh', overflow: 'hidden' }}
      >
        {/* Mobile Sidebar Overlay */}
        <div
          className={`sidebar-mobile-overlay ${isSidebarOpen ? 'open' : ''}`}
          onClick={() => setIsSidebarOpen(false)}
        />

        {/* Sidebar */}
        <aside
          className={`crm-sidebar w-64 shrink-0 flex flex-col h-screen overflow-hidden ${isSidebarOpen ? 'open' : ''}`}
          style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}
        >
          <div className="flex justify-end md:hidden mb-6 px-3 pt-4">
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-md transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Branding */}
          <div className="mb-6 pb-6 border-b border-slate-200 bg-[var(--surface)] z-20 px-6 pt-8" style={{ borderColor: 'var(--border)' }}>
            <div className="crm-sidebar-brand-wrap">
              <img src="/logo.png" alt="Cabtech Logo" className="crm-sidebar-brand-logo" style={{ maxWidth: '140px' }} />
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
            <NavItem
              active={activeTab === 'dashboard'}
              onClick={() => selectSidebarTab('dashboard')}
              icon={<LayoutDashboard size={18} />}
              label="Dashboard"
              color="#3b82f6"
            />

            <NavItem
              active={activeTab === 'email'}
              onClick={() => selectSidebarTab('email')}
              icon={<Mail size={18} />}
              label="Email"
              badge={counts.unreadEmails}
              color="#6366f1"
            />

            <NavItem
              active={activeTab === 'shopify'}
              onClick={() => selectSidebarTab('shopify')}
              icon={<ShoppingCart size={18} />}
              label="Shopify"
              badge={counts.newShopifyOrders}
              color="#a855f7"
            />

            {!isUser && (
              <>
                <NavItem active={activeTab === 'enquiries'} onClick={() => selectSidebarTab('enquiries')} icon={<Clock size={18} />} label="Enquiries" color="#f59e0b" />
                <NavItem
                  active={activeTab === 'tasks'}
                  onClick={() => selectSidebarTab('tasks')}
                  icon={<CheckCircle2 size={18} />}
                  label="Tasks"
                  badge={counts.pendingTasks}
                  color="#10b981"
                />
                <NavItem active={activeTab === 'delivery'} onClick={() => selectSidebarTab('delivery')} icon={<Truck size={18} />} label="Delivery" color="#3b82f6" />
                <NavItem active={activeTab === 'report'} onClick={() => selectSidebarTab('report')} icon={<FileText size={18} />} label="Report" color="#f43f5e" />
                <NavItem active={activeTab === 'customer-details'} onClick={() => selectSidebarTab('customer-details')} icon={<Plus size={18} />} label="Customer Details" color="#8b5cf6" />
                <NavItem active={activeTab === 'contacts'} onClick={() => selectSidebarTab('contacts')} icon={<Users size={18} />} label="Contacts" color="#06b6d4" />
                <NavItem active={activeTab === 'analytics'} onClick={() => selectSidebarTab('analytics')} icon={<TrendingUp size={18} />} label="Analytics" color="#f97316" />
                <NavItem active={activeTab === 'leads'} onClick={() => selectSidebarTab('leads')} icon={<Users size={18} />} label="Leads" color="#14b8a6" />
                <NavItem active={activeTab === 'follow-ups'} onClick={() => selectSidebarTab('follow-ups')} icon={<Clock size={18} />} label="Follow-Ups" color="#d946ef" />
                <NavItem active={activeTab === 'help-desk'} onClick={() => selectSidebarTab('help-desk')} icon={<MessageSquare size={18} />} label="Help Desk" color="#0ea5e9" />
              </>
            )}

            {canAccessElevatedTools && (
              <>
                <div className="pt-8 pb-3 px-3 text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Developer tools</div>
                <NavItem active={activeTab === "integrations"} onClick={() => selectSidebarTab("integrations")} icon={<Settings size={18} />} label="Shopify & Mail" color="#64748b" />
                <NavItem active={activeTab === "developer"} onClick={() => selectSidebarTab("developer")} icon={<ShieldCheck size={18} />} label="Developer" color="#ef4444" />
              </>
            )}
          </nav>

          <div className="mt-auto p-3 bg-[var(--surface)] border-t border-slate-100" style={{ borderColor: 'var(--border)' }}>
            <NavItem icon={<LogOut size={20} />} label="Sign Out" onClick={handleLogout} danger color="#dc2626" />
          </div>
        </aside>

        {/* Main Content */}
        <main className={`crm-main-content flex-1 min-w-0 overflow-y-auto ${activeTab === 'email' ? 'p-0' : 'p-6 md:p-10'}`}>
          {/* Mobile Header */}
          <div className="flex items-center justify-between mb-6 md:hidden">
            {/* FIX #14: Add logo to empty left side of mobile header */}
            <div className="flex-1">
              <img src="/logo.png" alt="Cabtech" style={{ height: 28 }} />
            </div>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 text-slate-900"
            >
              <Menu size={28} />
            </button>
          </div>
          {activeTab !== 'email' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="crm-header-controls flex items-center justify-between mb-8"
              style={{ gap: '1rem' }}
            >
              <div className="flex items-center gap-4">
                <h1
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: isSuperAdminOnly ? '#ea580c' : 'var(--text)' }}
                >
                  {isSuperAdminOnly ? 'SuperAdmin Dashboard' :
                    activeTab === 'dashboard' ? 'Insight Dashboard' :
                      activeTab === 'customer-details' ? 'Registration' :
                        activeTab === 'contacts' ? 'Contact Directory' :
                          activeTab === 'enquiries' ? 'Inquiry Management' :
                            activeTab === 'email' ? 'Communication Hub' :
                              activeTab === 'tasks' ? 'Task Workflow' :
                                activeTab === 'report' ? 'Performance Reporting' :
                                  activeTab === 'analytics' ? 'Data Analytics' :
                                    activeTab === 'leads' ? 'Lead Opportunity' :
                                      activeTab === 'follow-ups' ? 'Relationship Management' :
                                        activeTab === 'help-desk' ? 'Support Center' :
                                          'System Module'}
                </h1>
                {(counts.unreadEmails + counts.pendingTasks + counts.newShopifyOrders) > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-none text-[10px] font-bold uppercase tracking-wider animate-pulse">
                    <BellRing size={12} />
                    {counts.unreadEmails + counts.pendingTasks + counts.newShopifyOrders} NEW
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="h-10 px-4 pr-10 border border-slate-200 rounded-none bg-white text-[11px] font-black uppercase tracking-widest appearance-none cursor-pointer focus:ring-1 focus:ring-slate-900 outline-none"
                    style={{ minWidth: '120px' }}
                  >
                    <option value="All">Full Data</option>
                    <option value="2026">History 2026</option>
                    <option value="2025">History 2025</option>
                    <option value="2024">History 2024</option>
                    <option value="2023">History 2023</option>
                    <option value="2022">History 2022</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                    <Clock size={14} />
                  </div>
                </div>

                <div className="relative group" style={{ width: 'min(100%, 340px)' }}>
                  <input
                    type="text"
                    className="crm-header-search-input px-4 py-2 border border-slate-200 rounded-none transition-all w-full bg-white text-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-bold text-xs"
                    style={{ borderColor: 'var(--border)' }}
                    placeholder="Search enquiries or contacts..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowSearchDropdown(true);
                    }}
                  />
                  {searchTerm && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-500 animate-in fade-in duration-300">
                      {filteredEnquiries.length + filteredContacts.length} MATCHES
                    </div>
                  )}

                  <AnimatePresence>
                    {showSearchDropdown && searchTerm && (
                      <SearchResults
                        results={allResults}
                        searchTerm={searchTerm}
                        onCreateNew={handleCreateFromSearch}
                        onClose={() => { setShowSearchDropdown(false); setSearchTerm(''); }}
                        onNavigate={(tab) => { setActiveTab(tab); setShowSearchDropdown(false); setSearchTerm(''); }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!canManage) {
                    openInfoPopup('No Permission', 'You do not have permission to create records.', 'warning');
                    return;
                  }
                  setEditingEnquiry({ title: '', description: '' });
                  setIsModalOpen(true);
                }}
                className="crm-header-new-entry-btn crm-btn crm-btn-primary flex items-center px-6 h-10 text-[11px] font-black rounded-none transition-all shadow-sm justify-center gap-2 uppercase tracking-widest"
              >
                <Plus size={18} /> New Entry
              </button>
            </motion.div>
          )}

          {notAcceptedCount > 0 && activeTab !== 'email' && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="crm-notification-bar mb-6 px-5 py-3 rounded-none flex items-center justify-between gap-4 crm-notification-sticky"
            >
              <div className="flex items-center gap-3">
                <BellRing size={18} className="flex-shrink-0" />
                <div>
                  <div className="font-bold text-sm">{notAcceptedCount} {notAcceptedCount === 1 ? 'Entry' : 'Entries'} Pending</div>
                  <div className="text-xs opacity-80">Awaiting acceptance</div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('enquiries')}
                className="crm-btn crm-btn-primary h-10 px-5 rounded-md text-xs font-semibold flex-shrink-0"
              >
                View Now
              </button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <DashboardGrid
                  enquiries={safeEnquiries.filter(e => e.currentStage !== 4)}
                  onEmailClick={() => setActiveTab('email')}
                  onTasksClick={() => setActiveTab('tasks')}
                  onOrdersClick={() => setActiveTab('shopify')}
                  closureRows={safeEnquiries
                    .filter((e) => e.currentStage === 4 || e.currentStage === 9)
                    .sort((a, b) => new Date(b.updatedAt || b.UpdatedAt || 0).getTime() - new Date(a.updatedAt || a.UpdatedAt || 0).getTime())
                    .slice(0, 8)}
                  contacts={safeContacts}
                  onAdvance={advanceStage}
                  canManage={canManage}
                  counts={counts}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'email' && (
                <EmailPage
                  API_BASE={API_BASE}
                  refreshSignal={emailRefreshToken}
                  onViewPdf={(id) => setViewingAttachmentId(id)}
                />
              )}

              {activeTab === "tasks" && (
                <TasksPage API_BASE={API_BASE} refreshSignal={tasksRefreshToken} user={user} />
              )}

              {activeTab === "delivery" && (
                <DeliveryView API_BASE={API_BASE} user={user} openInfoPopup={openInfoPopup} />
              )}

              {activeTab === 'enquiries' && (
                <div className="space-y-6">
                  <div className="flex border-b border-slate-200 gap-8 mb-4">
                    {['Active', 'Rejected', 'Success'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setEnquiryStageFilter(tab)}
                        className={`pb-4 text-sm font-bold transition-all relative ${enquiryStageFilter === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {tab}
                        {enquiryStageFilter === tab && (
                          <motion.div layoutId="enquiryTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                        )}
                      </button>
                    ))}
                  </div>

                  <EnquiryList
                    enquiries={filteredEnquiries.filter(e => {
                      if (enquiryStageFilter === 'Active') return e.currentStage !== 4 && e.currentStage !== 9;
                      if (enquiryStageFilter === 'Rejected') return e.currentStage === 4;
                      if (enquiryStageFilter === 'Success') return e.currentStage === 9;
                      return true;
                    })}
                    onAdvance={advanceStage}
                    onDelete={requestDeleteEnquiry}
                    onEdit={(e) => { setEditingEnquiry(e); setIsEditModalOpen(true); }}
                    onStartAccept={startAcceptWorkflow}
                    onStartReject={startRejectWorkflow}
                    canManage={canManage}
                    onViewPdf={(id) => setViewingAttachmentId(id)}
                  />
                </div>
              )}

              {activeTab === 'customer-details' && (
                <div className="crm-fade-up">
                  <CustomerDetailsForm onSubmit={createCustomerDetails} />
                </div>
              )}

              {activeTab === 'review' && (
                <ReviewPage
                  enquiry={reviewEnquiry}
                  onSubmit={submitRejectReview}
                  onCancel={() => {
                    setReviewEnquiry(null);
                    setActiveTab('enquiries');
                  }}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsView enquiries={safeEnquiries} />
              )}

              {activeTab === 'contacts' && (
                <div className="space-y-6">
                  <div className="flex border-b border-slate-200 gap-8 mb-4">
                    {['All Contacts', 'New Entry'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setContactsSubTab(tab)}
                        className={`pb-4 text-sm font-bold transition-all relative ${contactsSubTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {tab}
                        {contactsSubTab === tab && (
                          <motion.div layoutId="contactsTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                        )}
                      </button>
                    ))}
                  </div>

                  {contactsSubTab === 'All Contacts' ? (
                    <ContactList contacts={filteredContacts} />
                  ) : (
                    <CustomerDetailsForm onSubmit={async (formData) => {
                      const success = await createCustomerDetails(formData);
                      if (success) setContactsSubTab('All Contacts');
                      return success;
                    }} />
                  )}
                </div>
              )}

              {activeTab === 'report' && (
                <div className="crm-fade-up">
                  <ReportView
                    contacts={safeContacts}
                    enquiries={filteredEnquiries}
                    onTenderConfirmed={requestTenderConfirmed}
                    onAskSuccess={requestAskSuccess}
                    onAskReject={(id) => { setRejectReportId(id); setIsRejectReportModalOpen(true); }}
                    onAcceptReport={requestAcceptFromReport}
                    canManage={canManage}
                  />
                </div>
              )}

              {activeTab === 'leads' && (
                <LeadsToolView contacts={safeContacts} enquiries={safeEnquiries} />
              )}

              {activeTab === 'help-desk' && (
                <HelpDeskView user={user} openInfoPopup={openInfoPopup} API_BASE={API_BASE} />
              )}

              {activeTab === 'follow-ups' && (
                <FollowUpsToolView enquiries={safeEnquiries} />
              )}

              {activeTab === 'integrations' && (
                canAccessElevatedTools ? (
                  <IntegrationsView apiBase={API_BASE} />
                ) : (
                  <ForbiddenPage
                    onBack={() => setActiveTab('dashboard')}
                    title="No permission"
                    message="Your administrator account does not have permission to access Shopify and mail integration settings. Contact a Super Admin or Dev Admin if you need access."
                  />
                )
              )}

              {activeTab === 'developer' && (
                canAccessElevatedTools ? (
                  <DeveloperView API_BASE={API_BASE} openInfoPopup={openInfoPopup} />
                ) : (
                  <ForbiddenPage
                    onBack={() => setActiveTab('dashboard')}
                    title="No permission"
                    message="Your administrator account does not have permission to access developer settings. Contact a Super Admin or Dev Admin if you need access."
                  />
                )
              )}
            </motion.div>
          </AnimatePresence>

          {/* Create Enquiry Modal */}
          {isModalOpen && (
            <CreateModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onSubmit={createNewEnquiry}
              contacts={safeContacts}
              user={user}
            />
          )}
        </main>
      </motion.div>
    </ErrorBoundary>
  );
};
export default App;





