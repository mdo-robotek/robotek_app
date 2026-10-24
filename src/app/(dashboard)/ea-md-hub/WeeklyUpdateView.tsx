"use client";

import { useState, useEffect } from 'react';
import { PlusIcon, XMarkIcon, PencilIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import Portal from '@/components/Portal';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import SearchableSelect from '@/components/SearchableSelect';

interface WeeklyItem {
  id: string;
  description: string;
  date?: string;
  teamMember?: string;
}

interface EditingItem extends WeeklyItem {
  category: string;
  categoryType: string;
}

interface DeleteTarget {
  id: string;
  categoryType: string;
  description: string;
}

export default function WeeklyUpdateView() {
  const toast = useToast();

  const [weekOf, setWeekOf] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [periodCovered, setPeriodCovered] = useState('');

  const [completedItems, setCompletedItems] = useState<WeeklyItem[]>([]);
  const [inProgressItems, setInProgressItems] = useState<WeeklyItem[]>([]);
  const [pendingItems, setPendingItems] = useState<WeeklyItem[]>([]);
  const [deadlineItems, setDeadlineItems] = useState<WeeklyItem[]>([]);
  const [teamQueryItems, setTeamQueryItems] = useState<WeeklyItem[]>([]);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);

  // Modal Form State
  const [modalDescription, setModalDescription] = useState('');
  const [modalDate, setModalDate] = useState('');
  const [modalTeamMember, setModalTeamMember] = useState('');

  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<{ id: string, label: string }[]>([]);

  // ─── Load items from sheet on mount ───────────────────────────────────────
  useEffect(() => {
    const loadItems = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/ea-md/weekly-update/get-items");

        if (res.ok) {
          const data = await res.json();

          const completed: WeeklyItem[] = [];
          const inProgress: WeeklyItem[] = [];
          const pending: WeeklyItem[] = [];
          const deadline: WeeklyItem[] = [];
          const teamQuery: WeeklyItem[] = [];

          data.items?.forEach((item: any) => {
            const weeklyItem: WeeklyItem = {
              id: item.id,
              description: item.description,
              date: item.date,
              teamMember: item.teamMember,
            };

            switch (item.category) {
              case 'Completed':       completed.push(weeklyItem); break;
              case 'In Progress':     inProgress.push(weeklyItem); break;
              case 'Pending MD action': pending.push(weeklyItem); break;
              case 'Upcoming deadline': deadline.push(weeklyItem); break;
              case 'Team query':      teamQuery.push(weeklyItem); break;
            }
          });

          // Reverse so latest sheet entry appears first
          setCompletedItems(completed.reverse());
          setInProgressItems(inProgress.reverse());
          setPendingItems(pending.reverse());
          setDeadlineItems(deadline.reverse());
          setTeamQueryItems(teamQuery.reverse());
        } else {
          toast.error("Failed to load weekly items.");
        }
      } catch (err) {
        toast.error("Error loading weekly items.");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const data = await res.json();
          const userOptions = data.map((user: any) => ({
            id: user.username,
            label: user.username
          }));
          setUsers(userOptions);
        }
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    loadItems();
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getCategoryName = (type: string): string => {
    const map: Record<string, string> = {
      'completed':  'Completed',
      'in-progress': 'In Progress',
      'pending':    'Pending MD action',
      'deadline':   'Upcoming deadline',
      'team-query': 'Team query',
    };
    return map[type] || type;
  };

  const applyToCategory = (
    categoryType: string,
    fn: (items: WeeklyItem[]) => WeeklyItem[]
  ) => {
    if (categoryType === 'completed')   setCompletedItems(fn(completedItems));
    else if (categoryType === 'in-progress') setInProgressItems(fn(inProgressItems));
    else if (categoryType === 'pending')     setPendingItems(fn(pendingItems));
    else if (categoryType === 'deadline')    setDeadlineItems(fn(deadlineItems));
    else if (categoryType === 'team-query')  setTeamQueryItems(fn(teamQueryItems));
  };

  // ─── Save new item (POST to sheet) ─ returns real sheet ID ──────────────
  const saveItemToSheet = async (item: WeeklyItem, category: string): Promise<string | null> => {
    if (!weekOf || !preparedBy || !periodCovered) {
      toast.info("Please fill in all header fields (Week Of, Prepared By, Period Covered) before adding items.");
      return null;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/ea-md/weekly-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            category,
            description: item.description,
            date: item.date,
            teamMember: item.teamMember,
            weekOf,
            preparedBy,
            periodCovered,
          }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setWeekOf(''); setPreparedBy(''); setPeriodCovered('');
        // Return the real sheet-generated ID (e.g. WKU-xxx-0)
        return data.ids?.[0] ?? item.id;
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.details?.message || errData.message || errData.error || `Server error (${res.status})`;
        toast.error("Failed to save: " + msg);
        return null;
      }
    } catch (e: any) {
      toast.error("Error saving: " + (e?.message || "Unknown error"));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Update item (PUT to sheet) ───────────────────────────────────────────
  const updateItemInSheet = async (itemId: string, updates: Partial<WeeklyItem & { category: string }>) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/ea-md/weekly-update?id=${encodeURIComponent(itemId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) return true;

      const errData = await res.json().catch(() => ({}));
      const msg = errData.details?.message || errData.message || errData.error || `Server error (${res.status})`;
      toast.error("Failed to update: " + msg);
      return false;
    } catch (e: any) {
      toast.error("Error updating: " + (e?.message || "Unknown error"));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Delete item (DELETE from sheet) ─────────────────────────────────────
  const deleteItemFromSheet = async (itemId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/ea-md/weekly-update?id=${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });

      if (res.ok) return true;

      const errData = await res.json().catch(() => ({}));
      const msg = errData.details?.message || errData.message || errData.error || `Server error (${res.status})`;
      toast.error("Failed to delete: " + msg);
      return false;
    } catch (e: any) {
      toast.error("Error deleting: " + (e?.message || "Unknown error"));
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Modal helpers ────────────────────────────────────────────────────────
  const openModal = (type: string) => {
    setEditingItem(null);
    setActiveModal(type);
    setModalDescription(''); setModalDate(''); setModalTeamMember('');
  };

  const openEditModal = (item: WeeklyItem, categoryType: string, category: string) => {
    setEditingItem({ ...item, category, categoryType });
    setActiveModal(null);
    setModalDescription(item.description);
    setModalDate(item.date || '');
    setModalTeamMember(item.teamMember || '');
  };

  const closeModal = () => {
    setActiveModal(null);
    setEditingItem(null);
    setModalDescription(''); setModalDate(''); setModalTeamMember('');
  };

  // ─── Form submit: add or edit ─────────────────────────────────────────────
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── EDIT MODE ───────────────────────────────────────────────────────────
    if (editingItem) {
      const updatedItem: WeeklyItem = {
        ...editingItem,
        description: modalDescription,
        date: modalDate,
        teamMember: modalTeamMember,
      };

      // Push to backend first
      const ok = await updateItemInSheet(editingItem.id, {
        description: modalDescription,
        date: modalDate,
        teamMember: modalTeamMember,
        category: getCategoryName(editingItem.categoryType),
      });

      if (ok) {
        applyToCategory(editingItem.categoryType, items =>
          items.map(i => (i.id === editingItem.id ? updatedItem : i))
        );
        closeModal();
        toast.success("Item updated in sheet!");
      }
      return;
    }

    // ── ADD MODE ─────────────────────────────────────────────────────────────
    if (!activeModal) return;

    const newItem: WeeklyItem = {
      id: Date.now().toString(),
      description: modalDescription,
      date: modalDate,
      teamMember: modalTeamMember,
    };

    const sheetId = await saveItemToSheet(newItem, getCategoryName(activeModal));

    if (sheetId) {
      // Use the real sheet ID so edit/delete can find the row later
      const savedItem: WeeklyItem = { ...newItem, id: sheetId };
      applyToCategory(activeModal, items => [savedItem, ...items]); // prepend = latest on top
      toast.success("Item added to sheet!");
      closeModal();
    }
  };

  // ─── Confirm delete ───────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, categoryType } = deleteTarget;

    const ok = await deleteItemFromSheet(id);

    if (ok) {
      applyToCategory(categoryType, items => items.filter(i => i.id !== id));
      toast.success("Item deleted from sheet!");
    }

    setDeleteTarget(null);
  };

  // ─── Date formatter: "2026-04-13" → "13 Apr 26" ──────────────────────────
  const formatDate = (raw: string): string => {
    if (!raw) return '';
    const d = new Date(raw + 'T00:00:00'); // force local midnight, no UTC shift
    if (isNaN(d.getTime())) return raw;    // fallback to raw if unparseable
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  // ─── Card renderer ────────────────────────────────────────────────────────
  const renderCard = (title: string, type: string, titleColor: string, items: WeeklyItem[]) => (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-600 overflow-hidden shadow-sm flex flex-col h-full min-h-[200px]">
      <div className="px-5 py-3.5 border-b border-gray-100 dark:border-navy-700 flex justify-between items-center">
        <h3 className={`font-semibold text-sm ${titleColor}`}>{title}</h3>
        <button
          onClick={() => openModal(type)}
          className="bg-[#1D4ED8] text-white px-3 py-1.5 rounded-md text-[13px] font-semibold flex items-center gap-1 hover:bg-[#1e3a8a] transition-all hover:scale-105 active:scale-95 shadow-sm"
        >
          <PlusIcon className="w-3 h-3 stroke-[3]" /> Add
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2.5 bg-[#fcfbfa] dark:bg-navy-900/50 overflow-y-auto max-h-[350px]">
        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[14px] text-gray-400 font-bold">No items yet</div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className="relative group bg-[#f4f3ec] dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg px-4 py-3 text-sm text-gray-800 dark:text-gray-200 shadow-sm flex flex-col gap-1 pr-24"
            >
              {item.teamMember && (
                <div className="text-[13px] font-semibold text-[#1D4ED8] dark:text-blue-400 mb-1">
                  {item.teamMember}
                </div>
              )}
              <div className="font-medium whitespace-pre-wrap">{item.description}</div>
              {item.date && (
                <div className="text-[13px] font-bold text-gray-500 mt-2 flex items-center gap-1 border-t border-gray-200/50 dark:border-navy-700 pt-1.5 w-max">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 block" />
                  {formatDate(item.date)}
                </div>
              )}

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => openEditModal(item, type, title)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-white dark:hover:bg-navy-700 rounded-md transition-all shadow-sm"
                  title="Edit"
                >
                  <PencilIcon className="w-3.5 h-3.5 stroke-[2]" />
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: item.id, categoryType: type, description: item.description })}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-navy-700 rounded-md transition-all shadow-sm"
                  title="Delete"
                >
                  <XMarkIcon className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full h-full overflow-y-auto invisible-scrollbar bg-transparent dark:bg-navy-900 space-y-6 text-left pb-16">

        {/* Loading spinner */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1D4ED8] mx-auto mb-4" />
              <p className="text-gray-500 font-semibold">Loading weekly updates...</p>
            </div>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Report Header */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-600 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-navy-700">
                <h3 className="font-semibold text-sm text-[#2563EB] dark:text-white">Report header</h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Week Of</label>
                  <div className="relative group/date">
                    <CalendarDaysIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-focus-within/date:text-[#2563EB]" />
                    <input type="date" value={weekOf} onChange={e => setWeekOf(e.target.value)}
                      className="w-full border border-gray-200 dark:border-navy-600 rounded-md pr-10 pl-3 py-2.5 outline-none focus:border-[#2563EB] text-sm dark:bg-navy-900 dark:text-white transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Prepared By</label>
                  <input type="text" placeholder="EA name" value={preparedBy} onChange={e => setPreparedBy(e.target.value)}
                    className="w-full border border-gray-200 dark:border-navy-600 rounded-md px-3 py-2.5 outline-none focus:border-[#2563EB] text-sm dark:bg-navy-900 dark:text-white transition-colors" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Period Covered</label>
                  <input type="text" placeholder="Mon DD - Fri DD Month" value={periodCovered} onChange={e => setPeriodCovered(e.target.value)}
                    className="w-full border border-gray-200 dark:border-navy-600 rounded-md px-3 py-2.5 outline-none focus:border-[#2563EB] text-sm dark:bg-navy-900 dark:text-white transition-colors" />
                </div>
              </div>
            </div>

            {/* 2-column grid cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderCard("Completed this week",        "completed",   "text-emerald-700 dark:text-emerald-500", completedItems)}
              {renderCard("In progress",                "in-progress", "text-[#1D4ED8] dark:text-blue-400",      inProgressItems)}
              {renderCard("Pending MD action",          "pending",     "text-orange-600",                         pendingItems)}
              {renderCard("Upcoming deadlines (14 days)", "deadline", "text-gray-900 dark:text-white",           deadlineItems)}
            </div>

            <div className="pb-8">
              {renderCard("Team queries for MD", "team-query", "text-gray-900 dark:text-white", teamQueryItems)}
            </div>
          </>
        )}
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      {(activeModal || editingItem) && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
            <div className="relative bg-white dark:bg-navy-900 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-white/20 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 dark:border-navy-800 flex justify-between items-center bg-[#FFFFFF] dark:bg-navy-900">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                    {editingItem ? "Edit Item" : (
                      <>
                        {activeModal === 'completed'   && "Add Completed item"}
                        {activeModal === 'in-progress' && "Add In-progress item"}
                        {activeModal === 'pending'     && "Add Pending MD action"}
                        {activeModal === 'deadline'    && "Add Upcoming deadline"}
                        {activeModal === 'team-query'  && "Add Team query"}
                      </>
                    )}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-gray-400 dark:text-slate-400 font-bold text-[12px]">EA-MD Hub</p>
                    <span className="px-2 py-0.5 bg-orange-50 dark:bg-navy-800 text-[12px] font-semibold text-[#2563EB] dark:text-[#60A5FA] rounded border border-orange-100 dark:border-navy-700">
                      Weekly Update
                    </span>
                  </div>
                </div>
                <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                  <XMarkIcon className="w-8 h-8" />
                </button>
              </div>

              {/* Saving overlay */}
              {isSaving && (
                <div className="absolute inset-0 bg-white/60 dark:bg-navy-900/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[14px] font-semibold text-gray-600 dark:text-white">
                      {editingItem ? "Updating..." : "Saving..."}
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleAddItem} className="p-8 space-y-6 bg-white dark:bg-navy-800/50 max-h-[80vh] overflow-y-auto">
                {/* Section Header */}
                <div>
                  <p className="text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] mb-1">Item Details</p>
                  <div className="h-0.5 w-10 bg-[#2563EB] dark:bg-[#60A5FA] rounded-full mb-4"></div>
                </div>
                {/* Team member field — team-query only */}
                {(activeModal === 'team-query' || editingItem?.categoryType === 'team-query') && (
                  <div className="space-y-1">
                    <label className="block text-[14px] font-semibold text-gray-700 dark:text-slate-300 mb-1.5 px-1">Team Member</label>
                    <SearchableSelect
                      options={users}
                      value={modalTeamMember}
                      onChange={setModalTeamMember}
                      placeholder="Select Team Member"
                      className="bg-[#FFFFFF] dark:bg-navy-900 border border-orange-100 dark:border-navy-700/50 shadow-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[13px] font-semibold text-gray-400 mb-1.5 px-1">Description *</label>
                  <textarea
                    required rows={4}
                    value={modalDescription}
                    onChange={e => setModalDescription(e.target.value)}
                    placeholder={
                      activeModal === 'completed'   ? "What was completed?" :
                      activeModal === 'in-progress' ? "What is underway?" :
                      activeModal === 'pending'     ? "What needs MD input?" :
                      activeModal === 'deadline'    ? "Deadline or event?" :
                      activeModal === 'team-query'  ? "Query for MD?" : "Enter description"
                    }
                    className="w-full bg-[#FFFFFF] dark:bg-navy-900 px-4 py-3 rounded-xl border border-orange-100 dark:border-navy-700/50 focus:border-[#2563EB] dark:focus:border-[#60A5FA] focus:bg-white outline-none text-[13px] font-bold text-gray-800 dark:text-white transition-all shadow-sm resize-none"
                  />
                </div>

                {/* Date field — in-progress, pending, deadline */}
                {((activeModal === 'in-progress' || activeModal === 'pending' || activeModal === 'deadline') ||
                  (editingItem?.categoryType === 'in-progress' || editingItem?.categoryType === 'pending' || editingItem?.categoryType === 'deadline')) && (
                  <div>
                    <label className="block text-[14px] font-semibold text-gray-700 dark:text-slate-300 mb-1.5 px-1">Date / Deadline</label>
                    <div className="relative group/date">
                      <CalendarDaysIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-focus-within/date:text-[#2563EB]" />
                      <input type="date" value={modalDate} onChange={e => setModalDate(e.target.value)}
                        className="w-full bg-[#FFFFFF] dark:bg-navy-900 pr-10 pl-3 py-2.5 rounded-xl border border-orange-100 dark:border-navy-700/50 focus:border-[#2563EB] outline-none text-sm text-gray-900 dark:text-white transition-all shadow-sm" />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex justify-end gap-5">
                  <button type="button" onClick={closeModal} disabled={isSaving} className="px-8 py-3 rounded-xl text-[13px] font-semibold text-gray-400 hover:text-gray-900 transition-colors">
                    Dismiss
                  </button>
                  <button type="submit" disabled={isSaving} 
                    className="px-12 py-3 rounded-xl text-[14px] font-semibold text-white bg-[#2563EB] dark:bg-[#60A5FA] dark:text-black hover:shadow-xl transition-all active:scale-95 shadow-lg border-b-4 border-black/20"
                  >
                    {isSaving ? (editingItem ? "Updating..." : "Saving...") : editingItem ? "Update Item" : "Confirm & Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Item"
        message={deleteTarget ? `Remove "${deleteTarget.description.slice(0, 60)}${deleteTarget.description.length > 60 ? '…' : ''}"? This cannot be undone.` : ""}
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        type="danger"
      />
    </>
  );
}
