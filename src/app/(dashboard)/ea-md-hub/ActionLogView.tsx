"use client";

import { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  XMarkIcon, 
  PencilIcon, 
  TrashIcon,
  FunnelIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import Portal from '@/components/Portal';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import SearchableSelect from '@/components/SearchableSelect';

interface ActionItem {
  id: string;
  task: string;
  owner: string;
  priority: string;
  status: string;
  due: string;
  notes: string;
  timestamp?: string;
}

export default function ActionLogView() {
  const toast = useToast();

  const [items, setItems] = useState<ActionItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ActionItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<{ id: string, label: string }[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActionItem | null>(null);

  // Form State
  const [formTask, setFormTask] = useState('');
  const [formOwner, setFormOwner] = useState('');
  const [formPriority, setFormPriority] = useState('Medium');
  const [formStatus, setFormStatus] = useState('Not Started');
  const [formDue, setFormDue] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const filters = ['All', 'Urgent', 'MD action', 'In progress', 'Done'];

  useEffect(() => {
    loadItems();
    fetchUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [items, activeFilter]);

  const loadItems = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/ea-md/action-log/get-items");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      } else {
        toast.error("Failed to load action log.");
      }
    } catch (err) {
      toast.error("Error loading action log.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.map((u: any) => ({ id: u.username, label: u.username })));
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const applyFilters = () => {
    if (activeFilter === 'All') {
      setFilteredItems(items);
    } else {
      setFilteredItems(items.filter(item => {
        if (activeFilter === 'Urgent') return item.priority === 'Urgent';
        return item.status === activeFilter;
      }));
    }
  };

  const openModal = (item: ActionItem | null = null) => {
    if (item) {
      setEditingItem(item);
      setFormTask(item.task);
      setFormOwner(item.owner);
      setFormPriority(item.priority);
      setFormStatus(item.status);
      setFormDue(item.due);
      setFormNotes(item.notes);
    } else {
      setEditingItem(null);
      setFormTask('');
      setFormOwner('');
      setFormPriority('Medium');
      setFormStatus('Not Started');
      setFormDue('');
      setFormNotes('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      task: formTask,
      owner: formOwner,
      priority: formPriority,
      status: formStatus,
      due: formDue,
      notes: formNotes,
    };

    try {
      if (editingItem) {
        const res = await fetch(`/api/ea-md/action-log?id=${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...payload } : i));
          toast.success("Action item updated!");
          closeModal();
        } else {
          toast.error("Failed to update item.");
        }
      } else {
        const res = await fetch("/api/ea-md/action-log", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [payload] }),
        });

        if (res.ok) {
          const data = await res.json();
          const newItem = { ...payload, id: data.ids[0] };
          setItems(prev => [newItem, ...prev]);
          toast.success("Action item created!");
          closeModal();
        } else {
          toast.error("Failed to create item.");
        }
      }
    } catch (err) {
      toast.error("Network error saving item.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/ea-md/action-log?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
        toast.success("Item removed!");
      } else {
        toast.error("Failed to delete item.");
      }
    } catch (err) {
      toast.error("Error deleting item.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const getPriorityStyle = (p: string) => {
    switch(p) {
      case 'Urgent': return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-400';
      case 'High':   return 'bg-[#F7F8FA] text-[#D97706] border-[#E5E7EB] dark:bg-[#FEF3C7] dark:text-[#D97706]';
      case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400';
      default:       return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400';
    }
  };

  const getStatusStyle = (s: string) => {
    switch(s) {
      case 'Done':      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400';
      case 'In progress': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400';
      case 'MD action':  return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-400';
      default:           return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getFilterCount = (filter: string) => {
    if (filter === 'All') return items.length;
    if (filter === 'Urgent') return items.filter(i => i.priority === 'Urgent').length;
    return items.filter(i => i.status === filter).length;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      {/* Filter & Action Bar */}
      <div className="bg-white dark:bg-navy-800 p-3 rounded-2xl border border-gray-100 dark:border-navy-700 shadow-sm flex items-center justify-between overflow-x-auto no-scrollbar gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#5B6472] px-2">Filter:</span>
          {filters.map(f => {
            const count = getFilterCount(f);
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold   transition-all flex items-center gap-2 ${
                  activeFilter === f 
                  ? 'bg-[#1D4ED8] text-white shadow-md scale-105' 
                  : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100 dark:bg-navy-900 dark:border-white/5'
                }`}
              >
                {f}
                <span className={`px-1.5 py-0.5 rounded-full text-[12px] ${
                  activeFilter === f ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        
        <button 
          onClick={() => openModal()}
          className="bg-[#1D4ED8] text-white px-5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2 hover:bg-[#1e3a8a] transition-all shrink-0 shadow-lg active:scale-95"
        >
          <PlusIcon className="w-4 h-4 stroke-[3]" /> New action item
        </button>
      </div>

      {/* Table Area */}
      <div className="flex-1 bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-700 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto h-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#1D4ED8] text-white">
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-12 text-center">#</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold">Task</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-32">Owner</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-28 text-center">Priority</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-32 text-center">Status</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-28 text-center">Due</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-24 text-center">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <ArrowPathIcon className="w-8 h-8 text-[#1D4ED8] animate-spin mx-auto opacity-20" />
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-[#5B6472] font-bold text-[14px] italic bg-gray-50/30">
                      No items found
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-navy-800/50 transition-colors group">
                      <td className="px-4 py-4 text-[13px] font-semibold text-[#5B6472] text-center">{index + 1}</td>
                      <td className="px-4 py-4 text-[14px] font-bold text-gray-800 dark:text-gray-200 min-w-[200px]">
                        {item.task}
                        {item.notes && (
                          <div className="mt-1 text-[13px] text-[#5B6472] font-medium italic truncate max-w-sm">
                            NB: {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-[13px] font-semibold text-[#1D4ED8] dark:text-blue-400">
                        {item.owner || "—"}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[12px] font-semibold   border ${getPriorityStyle(item.priority)}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[12px] font-semibold   border ${getStatusStyle(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-[13px] font-semibold text-gray-500">
                        {formatDate(item.due)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openModal(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all">
                            <PencilIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <button onClick={() => setDeleteTarget(item)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all">
                            <TrashIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      </div>

      {/* New / Edit Modal */}
      {isModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={closeModal} />
            <div className="relative bg-white dark:bg-navy-900 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/20 overflow-hidden">
                         <div className="px-8 py-6 border-b border-gray-100 dark:border-navy-800 flex justify-between items-center bg-[#FFFFFF] dark:bg-navy-900">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                    {editingItem ? "Update Task" : "Create New Task"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[#5B6472] dark:text-slate-400 font-bold text-[12px]">EA-MD Hub Action Tracker</p>
                    <span className="px-2 py-0.5 bg-[#F7F8FA] dark:bg-navy-800 text-[12px] font-semibold text-[#2563EB] dark:text-[#60A5FA] rounded border border-[#E5E7EB] dark:border-navy-700">
                      Task Details
                    </span>
                  </div>
                </div>
                <button onClick={closeModal} className="p-2 text-[#5B6472] hover:text-gray-600 dark:hover:text-white transition-colors">
                  <XMarkIcon className="w-8 h-8" />
                </button>
              </div>

              {isSaving && (
                <div className="absolute inset-0 bg-white/60 dark:bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              <form onSubmit={handleSave} className="p-8 space-y-6 bg-white dark:bg-navy-800/50 max-h-[80vh] overflow-y-auto">
                {/* Section Header */}
                <div>
                  <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] mb-1">Task Information</p>
                  <div className="h-0.5 w-10 bg-[#2563EB] dark:bg-[#60A5FA] rounded-full mb-4"></div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[#5B6472] mb-2 px-1">
                    Task Description *
                  </label>
                  <textarea required rows={3} value={formTask} onChange={e => setFormTask(e.target.value)}
                    placeholder="Enter task details..."
                    className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-4 py-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700/50 focus:border-[#2563EB] dark:focus:border-[#60A5FA] focus:bg-white outline-none text-[13px] font-bold text-gray-800 dark:text-white transition-all shadow-sm resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[13px] font-semibold text-[#5B6472] mb-2 px-1 block">
                      Owner *
                    </label>
                    <SearchableSelect 
                      options={users} 
                      value={formOwner} 
                      onChange={setFormOwner} 
                      placeholder="Assign to" 
                      className="bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-700/50"
                    />
                  </div>
                  <div>
                    <label className="text-[13px] font-semibold text-[#5B6472] mb-2 px-1 block">
                      Due Date *
                    </label>
                    <div className="relative group/date">
                      <CalendarDaysIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6472] pointer-events-none group-focus-within/date:text-[#2563EB] dark:group-focus-within/date:text-[#60A5FA]" />
                      <input required type="date" value={formDue} onChange={e => setFormDue(e.target.value)}
                        className="w-full bg-[#FFFFFF] dark:bg-navy-900 pr-12 pl-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700/50 focus:border-[#2563EB] dark:focus:border-[#60A5FA] outline-none text-sm font-bold text-gray-800 dark:text-white transition-all shadow-sm" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[#5B6472] mb-3 px-1">
                    Priority Level *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { l: 'Urgent', c: 'bg-rose-600 text-white border-rose-700' },
                      { l: 'High', c: 'bg-[#FEF3C7] text-white border-[#E5E7EB]' },
                      { l: 'Medium', c: 'bg-amber-500 text-white border-amber-600' },
                      { l: 'Low', c: 'bg-blue-600 text-white border-blue-700' }
                    ].map(p => {
                      const isActive = formPriority === p.l;
                      return (
                        <button
                          key={p.l}
                          type="button"
                          onClick={() => setFormPriority(p.l)}
                          className={`flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold   border transition-all shadow-sm ${
                            isActive 
                            ? p.c + ' ring-2 ring-offset-1 ring-gray-100 scale-105'
                            : 'bg-white text-[#5B6472] border-gray-200 dark:bg-navy-900 dark:border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-100'
                          }`}
                        >
                          {p.l}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[#5B6472] mb-3 px-1">
                    Task Status *
                  </label>
                  <div className="flex flex-row overflow-x-auto no-scrollbar gap-2 pb-1">
                    {[
                      { l: 'Not Started', c: 'bg-gray-600 text-white border-gray-700' },
                      { l: 'In progress', c: 'bg-blue-600 text-white border-blue-700' },
                      { l: 'MD action', c: 'bg-purple-600 text-white border-purple-700' },
                      { l: 'Done', c: 'bg-emerald-600 text-white border-emerald-700' }
                    ].map(s => {
                      const isActive = formStatus === s.l;
                      return (
                        <button
                          key={s.l}
                          type="button"
                          onClick={() => setFormStatus(s.l)}
                          className={`flex-1 min-w-[100px] px-3 py-3 rounded-xl text-[13px] font-semibold   border transition-all text-center whitespace-nowrap shadow-sm ${
                            isActive 
                            ? s.c + ' ring-2 ring-offset-1 ring-gray-100'
                            : 'bg-white text-[#5B6472] border-gray-200 dark:bg-navy-900 dark:border-white/5 opacity-60 hover:opacity-100'
                          }`}
                        >
                          {s.l}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-[#5B6472] mb-2 px-1 block">Notes & Details</label>
                  <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                    placeholder="Any specific instructions?"
                    className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-navy-700/50 focus:border-[#2563EB] dark:focus:border-[#60A5FA] outline-none text-sm font-bold text-gray-800 dark:text-white transition-all shadow-sm" />
                </div>

                <div className="pt-4 flex justify-end gap-5">
                  <button type="button" onClick={closeModal} className="px-8 py-3 rounded-xl text-[13px] font-semibold text-[#5B6472] hover:text-gray-900 transition-colors">
                    Dismiss
                  </button>
                  <button type="submit" 
                    className="px-12 py-3 rounded-xl text-[14px] font-semibold text-white bg-[#2563EB] dark:bg-[#60A5FA] dark:text-black hover:shadow-xl transition-all active:scale-95 shadow-lg border-b-4 border-black/20"
                  >
                    {editingItem ? "Update Changes" : "Confirm & Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete action item"
        message="This will permanently remove this task from the log. Continue?"
        type="danger"
      />
    </div>
  );
}
