import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Package, Clock, CheckCircle, Plus, X, Search, ChevronRight, User, Hash, MapPin } from 'lucide-react';

const STAGES = [
  { id: 1, name: 'Item Dispatched', icon: <Package size={16} /> },
  { id: 2, name: 'Person Collected', icon: <Truck size={16} /> },
  { id: 3, name: 'Reached Location', icon: <MapPin size={16} /> },
  { id: 4, name: 'Delivery Completed', icon: <CheckCircle size={16} /> }
];

const DeliveryView = ({ API_BASE, user, openInfoPopup }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStage, setFilterStage] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: ''
  });

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/Core/delivery`);
      setDeliveries(res.data);
    } catch (err) {
      console.error('Failed to fetch deliveries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim() || !formData.assignedTo.trim()) {
      if (openInfoPopup) openInfoPopup('Validation', 'Please fill out all fields.', 'warning');
      return;
    }

    try {
      await axios.post(`${API_BASE}/Core/delivery`, {
        ...formData,
        updatedBy: user?.username || 'Admin'
      });
      setIsModalOpen(false);
      setFormData({ title: '', description: '', assignedTo: '' });
      fetchDeliveries();
      if (openInfoPopup) openInfoPopup('Success', 'Delivery task created.', 'success');
    } catch (err) {
      console.error('Failed to create delivery:', err);
      if (openInfoPopup) openInfoPopup('Error', 'Unable to create delivery right now.', 'error');
    }
  };

  const updateStage = async (id, stageId) => {
    if (stageId > 4) return;
    try {
      await axios.post(`${API_BASE}/Core/delivery/${id}/stage`, {
        stageId,
        updatedBy: user?.username || 'Admin'
      });
      fetchDeliveries();
      if (openInfoPopup && stageId === 4) {
        openInfoPopup('Very Good Job! 🎉', 'Delivery person successfully completed the delivery.', 'success');
      }
    } catch (err) {
      console.error('Failed to update stage:', err);
      if (openInfoPopup) openInfoPopup('Error', 'Unable to update delivery stage right now.', 'error');
    }
  };

  const deleteDelivery = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this delivery task?")) return;
    try {
      await axios.delete(`${API_BASE}/Core/delivery/${id}`);
      fetchDeliveries();
      if (openInfoPopup) openInfoPopup('Deleted', 'Delivery record removed.', 'success');
    } catch (err) {
      console.error('Failed to delete:', err);
      if (openInfoPopup) openInfoPopup('Error', 'Failed to delete delivery.', 'error');
    }
  };

  const filtered = filterStage ? deliveries.filter(d => d.currentStage === filterStage) : deliveries;

  // Render a specific column for the board view
  const renderColumn = (stage) => {
    const stageDeliveries = filtered.filter(d => d.currentStage === stage.id);

    return (
      <div key={stage.id} className="flex-1 min-w-[250px]">
        <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-slate-900">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            {stage.icon}
            {stage.name}
          </h3>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-none">{stageDeliveries.length}</span>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {stageDeliveries.map(d => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 p-5 rounded-none shadow-sm hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Hash size={10} /> DL-{d.id}
                  </div>
                  {user?.role === 'DevAdmin' && (
                    <button onClick={() => deleteDelivery(d.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={14} />
                    </button>
                  )}
                </div>

                <h4 className="text-sm font-black text-slate-900 mb-2">{d.title}</h4>
                <p className="text-xs text-slate-600 mb-4 line-clamp-2 leading-relaxed">{d.description}</p>

                <div className="flex items-center gap-2 mb-4 p-2 bg-slate-50 border border-slate-100">
                  <User size={12} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{d.assignedTo}</span>
                </div>

                {d.currentStage < 4 ? (
                  <button
                    onClick={() => updateStage(d.id, d.currentStage + 1)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-colors rounded-none"
                  >
                    Advance <ChevronRight size={14} />
                  </button>
                ) : (
                  <div className="w-full py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 rounded-none">
                    <CheckCircle size={14} /> Completed
                  </div>
                )}
              </motion.div>
            ))}
            {stageDeliveries.length === 0 && !loading && (
              <div className="py-8 px-4 border-2 border-dashed border-slate-100 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                No tasks
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 border border-slate-200 shadow-sm rounded-none">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <Truck className="text-blue-600" size={28} />
            Delivery Management
          </h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Track & Manage Operations</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-black hover:bg-slate-900 text-white px-6 py-3 rounded-none font-black text-[11px] uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
          style={{ backgroundColor: 'black', color: 'white' }}
        >
          <Plus size={16} /> New Delivery
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 p-2 bg-white border border-slate-200 overflow-x-auto rounded-none">
        <button
          onClick={() => setFilterStage(null)}
          className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors rounded-none ${!filterStage ? 'bg-slate-900 text-white shadow-md shadow-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          All Stages
        </button>
        {STAGES.map(s => (
          <button
            key={s.id}
            onClick={() => setFilterStage(s.id)}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors rounded-none flex items-center gap-2 ${filterStage === s.id ? 'bg-slate-900 text-white shadow-md shadow-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 pb-4">
        {STAGES.map(stage => renderColumn(stage))}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white max-w-md w-full shadow-2xl rounded-none border border-slate-200"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Plus size={16} /> Assign Delivery Task
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Delivery Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Server Rack Delivery"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-sm font-bold text-slate-900 border border-slate-200 rounded-none px-4 py-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Assign To (Personnel)</label>
                <select
                  required
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className="w-full text-sm font-bold text-slate-900 border border-slate-200 rounded-none px-4 py-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                >
                  <option value="" disabled>Select Delivery Personnel</option>
                  <option value="John (Van A)">John (Van A)</option>
                  <option value="Mike (Truck 1)">Mike (Truck 1)</option>
                  <option value="Sarah (Bike 3)">Sarah (Bike 3)</option>
                  <option value="Alex (Van B)">Alex (Van B)</option>
                  <option value="David (Truck 2)">David (Truck 2)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Items / Description</label>
                <textarea
                  required
                  placeholder="List the items or specifics for this delivery..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full resize-none text-sm font-bold text-slate-900 border border-slate-200 rounded-none px-4 py-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-900 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors rounded-none bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-black hover:bg-slate-900 text-white text-xs font-black uppercase tracking-widest shadow-lg transition-all rounded-none"
                  style={{ backgroundColor: 'black', color: 'white' }}
                >
                  Create Task
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DeliveryView;
