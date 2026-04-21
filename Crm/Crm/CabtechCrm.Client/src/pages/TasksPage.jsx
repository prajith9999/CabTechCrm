import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { CheckCircle2, Clock, Plus, Trash2, Calendar, X, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TasksPage = ({ API_BASE, refreshSignal = 0, user }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', assignedTo: '' });
  const [filter, setFilter] = useState('All');

  // Status/Progress Modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [delayReason, setDelayReason] = useState('');
  const [expectedTime, setExpectedTime] = useState('');
  const [showSuperb, setShowSuperb] = useState(false);
  const [showStayPositive, setShowStayPositive] = useState(false);
  const [showDelayForm, setShowDelayForm] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/Core/tasks`);
      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async () => {
    if (!newTask.title) return;
    try {
      await axios.post(`${API_BASE}/Core/tasks`, newTask);
      setIsModalOpen(false);
      setNewTask({ title: '', description: '', dueDate: '', assignedTo: '' });
      fetchTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const updateProgress = async (id, status, reason = null, time = null) => {
    try {
      await axios.post(`${API_BASE}/Core/tasks/${id}/progress`, {
        status,
        delayReason: reason,
        expectedCompletionAt: time
      });

      if (status === 'Completed') {
        setShowSuperb(true);
        setTimeout(() => setShowSuperb(false), 3000);
      } else if (status === 'Pending' && reason) {
        setShowStayPositive(true);
        setTimeout(() => setShowStayPositive(false), 3000);
      }

      setStatusModalOpen(false);
      setSelectedTask(null);
      setDelayReason('');
      setExpectedTime('');
      setShowDelayForm(false);
      fetchTasks();
    } catch (error) {
      console.error('Failed to update task progress:', error);
    }
  };

  const deleteTask = async (id) => {
    try {
      await axios.delete(`${API_BASE}/Core/tasks/${id}`);
      setConfirmDeleteOpen(false);
      setSelectedTask(null);
      fetchTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (refreshSignal > 0) {
      fetchTasks();
    }
  }, [refreshSignal]);

  const filtered = tasks.filter((t) => {
    const statusOk = filter === 'All' ? true : t.status === filter;
    return statusOk;
  });

  // Calculate Task Analytics
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pending = total - completed;
    
    // Calculate overdue (active tasks only)
    const now = new Date();
    now.setHours(0,0,0,0);
    const overdue = tasks.filter(t => {
      if (t.status === 'Completed' || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      due.setHours(0,0,0,0);
      return due < now;
    }).length;

    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    return { total, completed, pending, overdue, progress };
  }, [tasks]);

  const renderDueDateBadge = (dueDate, status) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    due.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (status === 'Completed') {
      return (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-none border border-slate-100">
          <Calendar size={10} />
          {due.toLocaleDateString()}
        </div>
      );
    }

    if (diffDays < 0) {
      return (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded-none border border-red-200">
          <Clock size={10} className="animate-pulse" />
          Overdue by {Math.abs(diffDays)} day{Math.abs(diffDays) > 1 ? 's' : ''}
        </div>
      );
    } else if (diffDays === 0) {
      return (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-none border border-amber-200">
          <AlertCircle size={10} />
          Due Today
        </div>
      );
    } else if (diffDays <= 3) {
      return (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-none border border-indigo-200">
          <Calendar size={10} />
          Due in {diffDays} days
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-none border border-emerald-200">
          <Calendar size={10} />
          {due.toLocaleDateString()}
        </div>
      );
    }
  };


  return (
    <div className="space-y-6 font-sans">
      {/* Superb Notification */}
      <AnimatePresence>
        {showSuperb && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-10 py-5 rounded-none shadow-2xl flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-white/20 rounded-none flex items-center justify-center">
              <Check size={28} />
            </div>
            <div>
              <div className="text-2xl font-black italic tracking-tighter">SUPERB!</div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Task Completed Successfully</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stay Positive Notification */}
      <AnimatePresence>
        {showStayPositive && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white px-10 py-5 rounded-none shadow-2xl flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-white/20 rounded-none flex items-center justify-center">
              <Clock size={28} />
            </div>
            <div>
              <div className="text-xl font-black italic tracking-tighter uppercase">We can try again</div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-90 block mt-0.5">Don't worry, stay positive!</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-md">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 capitalize tracking-tight leading-tight mb-1">Tasks Module</h2>
            <p className="text-slate-500 text-xs font-semibold capitalize opacity-70">Team Assignments & Deadlines</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex bg-white border border-slate-200 rounded-none p-1 shadow-sm">
            {['All', 'Pending', 'Completed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-xs font-bold rounded-none transition-all ${filter === f ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-none text-sm font-bold hover:bg-black transition-all shadow-md group border border-slate-900"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
            New Task
          </button>
        </div>
      </div>

      {/* Mini Analytics Dashboard */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Tasks</div>
            <div className="text-3xl font-black text-slate-900 tracking-tighter">{stats.total}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-5 shadow-sm flex flex-col justify-between">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Active</div>
            <div className="text-3xl font-black text-blue-700 tracking-tighter">{stats.pending}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-5 shadow-sm flex flex-col justify-between">
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Completed</div>
            <div className="text-3xl font-black text-emerald-700 tracking-tighter">{stats.completed}</div>
          </div>
          <div className="bg-red-50 border border-red-200 p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-2">Overdue</div>
            <div className="text-3xl font-black text-red-700 tracking-tighter">{stats.overdue}</div>
            {stats.overdue > 0 && (
              <div className="absolute top-0 right-0 w-1.5 h-full bg-red-500 animate-pulse" />
            )}
          </div>
        </div>

        <div className="bg-slate-100 h-1.5 w-full overflow-hidden border border-slate-200">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${stats.progress}%` }} 
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-emerald-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-none border border-slate-200 shadow-sm overflow-hidden">
        {loading && tasks.length === 0 ? (
          <div className="p-20 text-center">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-10 w-10 bg-slate-100 rounded-none mb-4"></div>
              <div className="h-4 w-48 bg-slate-50 rounded-none mb-2"></div>
              <div className="h-3 w-32 bg-slate-50 rounded-none"></div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-20 text-center">
            <CheckCircle2 className="mx-auto text-slate-100 mb-4" size={48} />
            <p className="text-slate-400 font-medium text-xs tracking-widest uppercase">All clear! No tasks here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(task => (
              <motion.div
                layout
                key={task.id}
                className={`group flex items-center gap-6 p-6 transition-colors border-l-4 rounded-none ${task.status === 'Completed' ? 'bg-slate-50/30 grayscale border-slate-200' : 'hover:bg-slate-50/50 border-transparent hover:border-slate-900'}`}
              >
                <div className={`w-10 h-10 shrink-0 flex items-center justify-center shadow-sm transition-all ${task.status === 'Completed' ? 'bg-slate-200 text-slate-400 rounded-none' : 'bg-emerald-500 text-white rounded-none'}`}>
                  <CheckCircle2 size={20} />
                </div>

                <div className="flex-1">
                  <h4 className={`text-base font-bold mb-0.5 transition-all truncate-ellipsis ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    {task.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-slate-500 line-clamp-1">{task.description || 'No description'}</p>
                    {task.assignedTo && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded-none">
                        {task.assignedTo}
                      </span>
                    )}
                    {renderDueDateBadge(task.dueDate, task.status)}
                    {task.delayReason && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded-none border border-red-100">
                        <AlertCircle size={10} />
                        Delayed: {task.delayReason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {task.status === 'Completed' ? (
                    <div className="flex gap-1 items-center bg-emerald-50 px-3 py-1.5 border border-emerald-100 shadow-sm rounded-none">
                      <Check size={12} className="text-emerald-500" />
                      <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                        COMPLETED
                      </div>
                    </div>
                  ) : (
                    <div className="flex bg-slate-100 p-1 rounded-none ring-1 ring-slate-200 shadow-sm">
                      <button
                        onClick={() => updateProgress(task.id, 'Completed')}
                        className="px-3 py-1.5 bg-white shadow-sm rounded-none text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-700 transition-all flex items-center gap-1.5"
                      >
                        <Check size={12} /> Complete
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowDelayForm(true);
                          setStatusModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-transparent hover:bg-slate-200 rounded-none text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-all flex items-center gap-1.5"
                      >
                        <Clock size={12} /> Delay
                      </button>
                    </div>
                  )}
                  {user?.role === 'DevAdmin' && (
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setConfirmDeleteOpen(true);
                      }}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-none border border-transparent hover:border-red-100"
                      title="Remove Task"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* New Task Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-none p-10 shadow-2xl w-full max-w-md border border-slate-200 relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-xl font-black italic tracking-tighter text-slate-900">
                  CREATE NEW TASK
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-900 transition-colors p-1"
                  title="Close"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Title</label>
                  <input
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-100 rounded-none text-sm focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                    value={newTask.title}
                    onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Description</label>
                  <textarea
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-100 rounded-none text-sm focus:border-slate-900 outline-none transition-all resize-none font-medium text-slate-700"
                    rows={3}
                    value={newTask.description}
                    onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Due Date</label>
                    <input
                      type="date"
                      max="2030-12-31"
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-100 rounded-none text-sm focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                      value={newTask.dueDate}
                      onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Assigned to</label>
                    <input
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-100 rounded-none text-sm focus:border-slate-900 outline-none transition-all font-bold text-slate-900"
                      value={newTask.assignedTo}
                      onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-10">
                  <button
                    type="button"
                    onClick={createTask}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl active:scale-95 uppercase tracking-[0.3em] text-xs transition-all hover:bg-black"
                  >
                    Assign Task
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Update Modal (Greeting or Delay) */}
      <AnimatePresence>
        {statusModalOpen && selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-none w-full max-w-xs border border-slate-200 overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest italic text-slate-800">Update Task Progress</h3>
                <button onClick={() => setStatusModalOpen(false)} className="text-slate-400 hover:text-slate-900"><X size={18} /></button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Task</div>
                  <div className="text-base font-black text-slate-900 leading-tight">{selectedTask.title}</div>
                </div>

                {!showDelayForm ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => updateProgress(selectedTask.id, 'Completed')}
                      className="w-full py-4 bg-emerald-600 text-white rounded-none font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-lg hover:bg-emerald-700 transition-all"
                    >
                      <Check size={18} />
                      Completed
                    </button>
                    <button
                      onClick={() => setShowDelayForm(true)}
                      className="w-full py-4 bg-slate-900 text-white rounded-none font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-lg hover:bg-black transition-all"
                    >
                      <AlertCircle size={18} />
                      Not Completed
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Delay Reason</label>
                      <textarea
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-none text-sm focus:border-red-500 outline-none transition-all resize-none"
                        rows={3}
                        value={delayReason}
                        onChange={e => setDelayReason(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">New Expected Time</label>
                      <input
                        type="datetime-local"
                        max="2030-12-31T23:59"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-none text-xs font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500 outline-none"
                        value={expectedTime}
                        onChange={e => setExpectedTime(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => setStatusModalOpen(false)}
                        className="w-1/3 py-2.5 bg-slate-100 text-slate-600 rounded-none font-bold uppercase tracking-widest text-[10px] shadow-sm hover:bg-slate-200 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (!delayReason.trim()) return; // FIX #6: Require reason before submit
                          updateProgress(selectedTask.id, 'Pending', delayReason, expectedTime);
                        }}
                        disabled={!delayReason.trim()}
                        className="w-2/3 py-2.5 bg-emerald-500 text-white rounded-none font-bold uppercase tracking-widest text-[10px] shadow-md hover:bg-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteOpen && selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-none w-full max-w-xs border border-slate-200 overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-none flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 mb-2">Delete Task?</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mb-8 px-2">
                  This will permanently remove <span className="font-bold text-slate-900">"{selectedTask.title}"</span>. This action cannot be undone.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => deleteTask(selectedTask.id)}
                    className="w-full py-4 bg-red-600 text-white rounded-none font-bold uppercase tracking-widest text-[10px] shadow-lg hover:bg-red-700 transition-all"
                  >
                    Delete Permanently
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDeleteOpen(false);
                      setSelectedTask(null);
                    }}
                    className="w-full py-4 bg-white text-slate-400 rounded-none font-bold uppercase tracking-widest text-[10px] hover:text-slate-900 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TasksPage;
