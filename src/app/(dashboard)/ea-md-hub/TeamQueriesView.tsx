"use client";

import { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  XMarkIcon, 
  PencilIcon, 
  TrashIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  UserIcon,
  TagIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';
import Portal from '@/components/Portal';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import SearchableSelect from '@/components/SearchableSelect';

interface TeamQuery {
  id: string;
  teamMember: string;
  query: string;
  category: string;
  eaResolve: string;
  status: string;
  eaNotes: string;
  timestamp?: string;
}

export default function TeamQueriesView() {
  const toast = useToast();

  const [items, setItems] = useState<TeamQuery[]>([]);
  const [filteredItems, setFilteredItems] = useState<TeamQuery[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<{ id: string, label: string }[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TeamQuery | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamQuery | null>(null);

  // Form State
  const [formMember, setFormMember] = useState('');
  const [formQuery, setFormQuery] = useState('');
  const [formCategory, setFormCategory] = useState('HR / People');
  const [formEAResolve, setFormEAResolve] = useState('No - needs MD');
  const [formStatus, setFormStatus] = useState('New');
  const [formNotes, setFormNotes] = useState('');

  const filters = ['All', 'New', 'In progress', 'Resolved', 'Escalated'];

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
      const res = await fetch("/api/ea-md/team-queries/get-items");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      } else {
        toast.error("Failed to load queries.");
      }
    } catch (err) {
      toast.error("Error loading team queries.");
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
      setFilteredItems(items.filter(item => item.status === activeFilter));
    }
  };

  const openModal = (item: TeamQuery | null = null) => {
    if (item) {
      setEditingItem(item);
      setFormMember(item.teamMember);
      setFormQuery(item.query);
      setFormCategory(item.category);
      setFormEAResolve(item.eaResolve);
      setFormStatus(item.status);
      setFormNotes(item.eaNotes);
    } else {
      setEditingItem(null);
      setFormMember('');
      setFormQuery('');
      setFormCategory('HR / People');
      setFormEAResolve('No - needs MD');
      setFormStatus('New');
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
      teamMember: formMember,
      query: formQuery,
      category: formCategory,
      eaResolve: formEAResolve,
      status: formStatus,
      eaNotes: formNotes,
    };

    try {
      if (editingItem) {
        const res = await fetch(`/api/ea-md/team-queries?id=${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...payload } : i));
          toast.success("Query updated!");
          closeModal();
        } else {
          toast.error("Failed to update query.");
        }
      } else {
        const res = await fetch("/api/ea-md/team-queries", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [payload] }),
        });

        if (res.ok) {
          const data = await res.json();
          const newItem = { ...payload, id: data.ids[0] };
          setItems(prev => [newItem, ...prev]);
          toast.success("Query logged!");
          closeModal();
        } else {
          toast.error("Failed to log query.");
        }
      }
    } catch (err) {
      toast.error("Network error saving query.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/ea-md/team-queries?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
        toast.success("Query removed!");
      } else {
        toast.error("Failed to delete query.");
      }
    } catch (err) {
      toast.error("Error deleting query.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const getStatusStyle = (s: string) => {
    switch(s) {
      case 'Resolved':  return 'bg-emerald-600 text-white border-emerald-700';
      case 'In progress': return 'bg-blue-600 text-white border-blue-700';
      case 'Escalated':   return 'bg-rose-600 text-white border-rose-700';
      default:            return 'bg-gray-600 text-white border-gray-700';
    }
  };

  const getCategoryStyle = (c: string) => {
    switch(c) {
      case 'HR / People': return 'bg-purple-600 text-white border-purple-700';
      case 'Finance / Budget': return 'bg-teal-600 text-white border-teal-700';
      case 'Operations': return 'bg-amber-500 text-white border-amber-600';
      case 'Client / Project': return 'bg-indigo-600 text-white border-indigo-700';
      case 'IT / Systems':    return 'bg-cyan-600 text-white border-cyan-700';
      default:            return 'bg-gray-500 text-white border-gray-600';
    }
  };

  const getEAResolveStyle = (r: string) => {
    if (r?.toLowerCase().includes('yes')) return 'bg-emerald-600 text-white border-emerald-700';
    if (r?.toLowerCase().includes('maybe')) return 'bg-amber-500 text-white border-amber-600';
    return 'bg-rose-600 text-white border-rose-700';
  };

  const getFilterCount = (filter: string) => {
    if (filter === 'All') return items.length;
    return items.filter(i => i.status === filter).length;
  };

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      {/* Action Bar */}
      <div className="bg-white dark:bg-navy-800 p-3 rounded-2xl border border-gray-100 dark:border-navy-700 shadow-sm flex items-center justify-between overflow-x-auto no-scrollbar gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#5B6472] px-2">Filter:</span>
          {filters.map(f => (
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
              <span className={`px-1.5 py-0.5 rounded-full text-[14px] ${
                activeFilter === f ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {getFilterCount(f)}
              </span>
            </button>
          ))}
        </div>
        
        <button 
          onClick={() => openModal()}
          className="bg-[#1D4ED8] text-white px-5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2 hover:bg-[#1e3a8a] transition-all shrink-0 shadow-lg active:scale-95"
        >
          <PlusIcon className="w-4 h-4 stroke-[3]" /> Log query
        </button>
      </div>

      {/* Table Area */}
      <div className="flex-1 bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-700 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto h-full">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#1D4ED8] text-white">
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-12 text-center">#</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-40">Team Member</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold">Query</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-32 text-center">Category</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-40 text-center">EA Resolve?</th>
                  <th className="px-4 py-3.5 text-[13px] font-semibold w-32 text-center">Status</th>
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
                      No queries logged yet
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-navy-800/50 transition-colors group">
                      <td className="px-4 py-4 text-[13px] font-semibold text-[#5B6472] text-center">{index + 1}</td>
                      <td className="px-4 py-4 text-[13px] font-semibold text-[#1D4ED8] dark:text-blue-400">
                        {item.teamMember}
                      </td>
                      <td className="px-4 py-4 text-[14px] font-bold text-gray-800 dark:text-gray-200 min-w-[200px]">
                        {item.query}
                        {item.eaNotes && (
                          <div className="mt-1 text-[13px] text-[#5B6472] font-medium italic truncate max-w-sm">
                            Notes: {item.eaNotes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[14px] font-semibold   border ${getCategoryStyle(item.category)}`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[14px] font-semibold   border ${getEAResolveStyle(item.eaResolve)}`}>
                          {item.eaResolve}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[14px] font-semibold   border ${getStatusStyle(item.status)}`}>
                          {item.status}
                        </span>
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

      {/* Modal Form */}
      {isModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1D4ED8]/60 backdrop-blur-md" onClick={closeModal} />
            <div className="relative bg-white dark:bg-navy-900 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/20 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 dark:border-navy-800 flex justify-between items-center bg-[#FFFFFF] dark:bg-navy-900">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                    {editingItem ? "Update Query" : "Log Team Query"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[#5B6472] dark:text-slate-400 font-bold text-[14px]">Triage & Escalate Workspace</p>
                    <span className="px-2 py-0.5 bg-[#F7F8FA] dark:bg-navy-800 text-[14px] font-semibold text-[#2563EB] dark:text-[#60A5FA] rounded border border-[#E5E7EB] dark:border-navy-700">
                      Query Intake
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
                  <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] mb-1">Query Details</p>
                  <div className="h-0.5 w-10 bg-[#2563EB] dark:bg-[#60A5FA] rounded-full mb-4"></div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[#5B6472] mb-1.5 px-1 font-semibold">
                    <UserIcon className="w-3 h-3" /> Team Member *
                  </label>
                  <SearchableSelect 
                    options={users} 
                    value={formMember} 
                    onChange={setFormMember} 
                    placeholder="Who raised this?" 
                    className="bg-[#FFFFFF] dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-700/50 shadow-sm"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[#5B6472] mb-1.5 px-1 font-semibold">
                    <ChatBubbleBottomCenterTextIcon className="w-3 h-3" /> Query *
                  </label>
                  <textarea required rows={3} value={formQuery} onChange={e => setFormQuery(e.target.value)}
                    placeholder="Tell us what's happening..."
                    className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-4 py-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700/50 focus:border-[#2563EB] dark:focus:border-[#60A5FA] focus:bg-white outline-none text-[13px] font-bold text-gray-800 dark:text-white transition-all shadow-sm resize-none appearance-none" />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[#5B6472] mb-2 px-1 font-semibold">
                    <TagIcon className="w-3 h-3" /> Category *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['HR / People', 'Finance / Budget', 'Operations', 'Client / Project', 'IT / Systems', 'Others'].map(cat => {
                      const isActive = formCategory === cat;
                      const baseStyle = getCategoryStyle(cat);
                      return (
                        <button
                          key={cat} type="button" onClick={() => setFormCategory(cat)}
                          className={`flex-1 min-w-[100px] px-3 py-2 rounded-xl text-[13px] font-semibold   border transition-all ${
                            isActive ? baseStyle + ' ring-2 ring-offset-1 ring-gray-100 scale-105 shadow-md' : 'bg-white text-[#5B6472] border-gray-100 dark:bg-navy-900'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[#5B6472] mb-2 px-1 font-semibold">
                    <LightBulbIcon className="w-3 h-3" /> Can EA Resolve? *
                  </label>
                  <div className="flex gap-2">
                    {['No - needs MD', 'Yes - EA to handle', 'Maybe - check first'].map(opt => {
                      const isActive = formEAResolve === opt;
                      const baseStyle = getEAResolveStyle(opt);
                      return (
                        <button
                          key={opt} type="button" onClick={() => setFormEAResolve(opt)}
                          className={`flex-1 px-3 py-2 rounded-xl text-[13px] font-semibold   border transition-all ${
                            isActive ? baseStyle + ' ring-2 ring-offset-1 ring-gray-100 scale-105 shadow-md' : 'bg-white text-[#5B6472] border-gray-100 dark:bg-navy-900'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[#5B6472] mb-2 px-1 font-semibold">
                    <CheckCircleIcon className="w-3 h-3" /> Status *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['New', 'In progress', 'Resolved', 'Escalated'].map(s => {
                      const isActive = formStatus === s;
                      const baseStyle = getStatusStyle(s);
                      return (
                        <button
                          key={s} type="button" onClick={() => setFormStatus(s)}
                          className={`flex-1 px-3 py-2.5 rounded-xl text-[13px] font-semibold   border transition-all ${
                            isActive ? baseStyle + ' ring-2 ring-offset-1 ring-gray-100 scale-105' : 'bg-gray-50 text-[#5B6472] border-gray-100 dark:bg-navy-900'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                   <label className="text-[13px] font-semibold text-[#5B6472] mb-1.5 px-1 block font-semibold">EA Notes</label>
                   <textarea rows={2} value={formNotes} onChange={e => setFormNotes(e.target.value)}
                    placeholder="Initial notes..."
                    className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-4 py-3 rounded-xl border border-[#E5E7EB] dark:border-navy-700/50 focus:border-[#2563EB] dark:focus:border-[#60A5FA] focus:bg-white outline-none text-[13px] font-bold text-gray-800 dark:text-white transition-all shadow-sm resize-none appearance-none" />
                </div>

                <div className="pt-4 flex justify-end gap-5">
                  <button type="button" onClick={closeModal} className="px-8 py-3 rounded-xl text-[13px] font-semibold text-[#5B6472] hover:text-gray-900 transition-colors">
                    Dismiss
                  </button>
                  <button type="submit" 
                    className="px-12 py-3 rounded-xl text-[14px] font-semibold text-white bg-[#2563EB] dark:bg-[#60A5FA] dark:text-black hover:shadow-xl transition-all active:scale-95 shadow-lg border-b-4 border-black/20"
                  >
                    {editingItem ? "Update Changes" : "Confirm & Log Query"}
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
        title="Delete team query"
        message="This will permanently remove this query from the records. Continue?"
        type="danger"
      />
    </div>
  );
}
