"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Checklist, ChecklistOccurrence } from "@/types/checklist";
import { formatDateDdMmmYy, toDateOnlyString } from "@/lib/dateUtils";
import { 
  PlusIcon, 
  PencilSquareIcon, 
  TrashIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  PauseIcon,
  BoltIcon,
  TagIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
  UserIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  BuildingOfficeIcon,
  ShoppingBagIcon,
  ScaleIcon,
  FunnelIcon,
  WalletIcon,
  InboxIcon,
  BriefcaseIcon,
  LightBulbIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  LifebuoyIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  PlayIcon,
  MicrophoneIcon,
  PaperClipIcon,
  SparklesIcon as SparklesIconOutline,
  Squares2X2Icon,
  ListBulletIcon,
  CheckIcon
} from "@heroicons/react/24/outline";
import PremiumDatePicker from "@/components/PremiumDatePicker";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";
import Portal from "@/components/Portal";
import useSWR from "swr";

import { User } from "@/types/user";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ChecklistsPage() {
   const { data: session } = useSession();
   const userRole = (session?.user as any)?.role || "USER";
   const currentUser = (session?.user as any)?.username || "";

  const [usersList, setUsersList] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Checklist | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'due_date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('list');
  const [activeTab, setActiveTab] = useState<'tasks' | 'master'>('tasks');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Filters
  const [activeStatusFilters, setActiveStatusFilters] = useState<string[]>([]);
  const [dateFilters, setDateFilters] = useState<string[]>([]);
  const [assignmentFilter, setAssignmentFilter] = useState<'All' | 'ToMe' | 'ByMe'>('All');

  const [formData, setFormData] = useState<Partial<Checklist>>({
    id: "",
    task: "",
    assigned_by: "",
    assigned_to: "",
    priority: "Medium",
    department: "",
    frequency: "Daily",
    due_date: "",
    group_id: "",
  });

  const predefinedDepartments = [
    "Idea Department", "Sales", "Marketing", "Engineering", "Operations", 
    "HR", "Finance", "Customer Support", "Management"
  ];
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [departmentOpen, setDepartmentOpen] = useState(false);

  // Searchable Dropdown States
  const [assignedBySearch, setAssignedBySearch] = useState("");
  const [assignedToSearch, setAssignedToSearch] = useState("");
  const [assignedByOpen, setAssignedByOpen] = useState(false);
  const [assignedToOpen, setAssignedToOpen] = useState(false);

  // Filter Modal States
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [modalStartDate, setModalStartDate] = useState("");
  const [modalEndDate, setModalEndDate] = useState("");
  const [modalStatusFilter, setModalStatusFilter] = useState<string[]>([]);
  const [modalPriorityFilter, setModalPriorityFilter] = useState<string[]>([]);
  const [modalAssignedToFilter, setModalAssignedToFilter] = useState<string[]>([]);
  const [modalAssignedByFilter, setModalAssignedByFilter] = useState<string[]>([]);
  const [modalDepartmentFilter, setModalDepartmentFilter] = useState<string[]>([]);
  const [modalFrequencyFilter, setModalFrequencyFilter] = useState<string[]>([]);

  // Modal Dropdown/Search States
  const [modalStatusOpen, setModalStatusOpen] = useState(false);
  const [modalPriorityOpen, setModalPriorityOpen] = useState(false);
  const [modalAssignedToOpen, setModalAssignedToOpen] = useState(false);
  const [modalAssignedByOpen, setModalAssignedByOpen] = useState(false);
  const [modalDepartmentOpen, setModalDepartmentOpen] = useState(false);
  const [modalFrequencyOpen, setModalFrequencyOpen] = useState(false);

  const [modalStatusSearch, setModalStatusSearch] = useState("");
  const [modalAssignedToSearch, setModalAssignedToSearch] = useState("");
  const [modalAssignedBySearch, setModalAssignedBySearch] = useState("");
  const [modalDepartmentSearch, setModalDepartmentSearch] = useState("");
  const [modalFrequencySearch, setModalFrequencySearch] = useState("");

  // Action Status States
  const [actionStatus, setActionStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [actionMessage, setActionMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Confirmation states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Follow Up Sidebar States
  const [selectedTask, setSelectedTask] = useState<ChecklistOccurrence | Checklist | null>(null);
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isBulkCompleting, setIsBulkCompleting] = useState(false);
  /** Stuck Completed overrides — never cleared by a stale refetch. */
  const [localCompletions, setLocalCompletions] = useState<Record<string, string>>({});
 
   const [submitting, setSubmitting] = useState(false);

  // Server-side paginated SWR — no auto revalidate (complete updates are applied locally)
  const checklistSWRKey =
    currentUser
      ? `/api/checklists?page=${currentPage}&limit=${itemsPerPage}&view=${activeTab}&search=${encodeURIComponent(debouncedSearch)}&statusFilters=${encodeURIComponent(JSON.stringify(activeStatusFilters))}&assignmentFilter=${encodeURIComponent(assignmentFilter)}&currentUser=${encodeURIComponent(currentUser)}&userRole=${encodeURIComponent(userRole)}&dateFilters=${encodeURIComponent(JSON.stringify(dateFilters))}&startDate=${encodeURIComponent(modalStartDate)}&endDate=${encodeURIComponent(modalEndDate)}&modalStatus=${encodeURIComponent(JSON.stringify(modalStatusFilter))}&modalPriority=${encodeURIComponent(JSON.stringify(modalPriorityFilter))}&modalAssignedTo=${encodeURIComponent(JSON.stringify(modalAssignedToFilter))}&modalAssignedBy=${encodeURIComponent(JSON.stringify(modalAssignedByFilter))}&modalDepartment=${encodeURIComponent(JSON.stringify(modalDepartmentFilter))}&modalFrequency=${encodeURIComponent(JSON.stringify(modalFrequencyFilter))}&sortKey=${encodeURIComponent(sortConfig?.key || (activeTab === 'tasks' ? 'due_date' : 'id'))}&sortDir=${encodeURIComponent(sortConfig?.direction || 'desc')}`
      : null;
  const { data: paginationData, isLoading: isPageLoading, mutate: mutateChecklists } = useSWR<{
    data: (Checklist | ChecklistOccurrence)[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    statusCounts: Record<string, number>;
    dateCounts: Record<string, number>;
    toMeCount: number;
    byMeCount: number;
    counts: {
      priority: Record<string, number>;
      assignedTo: Record<string, number>;
      assignedBy: Record<string, number>;
      department: Record<string, number>;
      frequency: Record<string, number>;
    };
  }>(checklistSWRKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateOnMount: true,
    refreshInterval: 0,
    keepPreviousData: true,
  });
  const isLoading = isPageLoading;

  // No SSE revalidate on this page — it was wiping Completed back to Pending
  // before Sheets history was readable.

  const occurrenceKeyOf = (item: Checklist | ChecklistOccurrence) => {
    const occ = item as ChecklistOccurrence;
    if (occ.occurrence_key) return String(occ.occurrence_key);
    const due = toDateOnlyString(occ.occurrence_due_date || item.due_date) || "";
    const gid = item.group_id || `chk_${item.id}`;
    return `${gid}|${due}`;
  };

  const localCompletedDateFor = (item: Checklist | ChecklistOccurrence) => {
    const occ = item as ChecklistOccurrence;
    const due = toDateOnlyString(occ.occurrence_due_date || item.due_date) || "";
    const gid = String(item.group_id || `chk_${item.id}`);
    const keys = [
      occ.occurrence_key,
      `${gid}|${due}`,
      `chk_${item.id}|${due}`,
      `${item.id}|${due}`,
    ].filter(Boolean) as string[];
    for (const k of keys) {
      if (localCompletions[k]) return localCompletions[k];
    }
    // Fallback: any local key with same due date + matching id/group
    for (const [k, v] of Object.entries(localCompletions)) {
      if (!k.endsWith(`|${due}`)) continue;
      const left = k.slice(0, k.lastIndexOf("|"));
      if (
        left === gid ||
        left === `chk_${item.id}` ||
        left === String(item.id) ||
        left.endsWith(`_${item.id}`)
      ) {
        return v;
      }
    }
    return "";
  };

  const rememberLocalCompletions = (
    entries: { group_id: string; id?: string; due_date: string }[],
    completedDate: string
  ) => {
    setLocalCompletions((prev) => {
      const next = { ...prev };
      for (const e of entries) {
        const due = e.due_date;
        const gid = e.group_id;
        next[`${gid}|${due}`] = completedDate;
        if (e.id) {
          next[`${e.id}|${due}`] = completedDate;
          next[`chk_${e.id}|${due}`] = completedDate;
        }
        if (gid.startsWith("chk_")) {
          next[`${gid.replace(/^chk_/, "")}|${due}`] = completedDate;
        }
      }
      return next;
    });
  };

  // Always patch rows with local completions so Completed never flashes away
  const paginatedChecklists = (paginationData?.data || []).map((item) => {
    if (activeTab !== "tasks") return item;
    const occ = item as ChecklistOccurrence;
    const localDate = localCompletedDateFor(item);
    if (!localDate) return item;
    const due = toDateOnlyString(occ.occurrence_due_date || occ.due_date) || "";
    return {
      ...occ,
      display_status: "Completed",
      completed_date: occ.completed_date || localDate,
      is_late_complete: Boolean(
        (occ.completed_date || localDate) &&
          due &&
          (occ.completed_date || localDate) > due
      ),
    };
  });
  const totalPages = paginationData?.totalPages || 1;
  const statusCounts = (() => {
    const base = { ...(paginationData?.statusCounts || {}) };
    if (activeTab !== "tasks" || Object.keys(localCompletions).length === 0) return base;
    for (const item of paginationData?.data || []) {
      const occ = item as ChecklistOccurrence;
      if (!localCompletedDateFor(item) || occ.display_status === "Completed") continue;
      const prev = occ.display_status || "Pending";
      if (prev === "Pending") base.Pending = Math.max(0, (base.Pending || 0) - 1);
      if (prev === "Overdue") {
        base.Overdue = Math.max(0, (base.Overdue || 0) - 1);
        base.Delayed = Math.max(0, (base.Delayed || 0) - 1);
      }
      base.Completed = (base.Completed || 0) + 1;
    }
    return base;
  })();
  const dateCounts = paginationData?.dateCounts || {};
  const toMeCount = paginationData?.toMeCount || 0;
  const byMeCount = paginationData?.byMeCount || 0;
  const modalCounts = paginationData?.counts || { priority: {}, assignedTo: {}, assignedBy: {}, department: {}, frequency: {} };

   useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedTask) {
      fetchHistory(selectedTask.group_id || selectedTask.id);
    } else {
      setTaskHistory([]);
    }
  }, [selectedTask]);

  useEffect(() => {
    setCurrentPage(1);
    setActiveStatusFilters([]);
    setDateFilters([]);
    setSelectedKeys(new Set());
    setSortConfig(
      activeTab === "master"
        ? { key: "id", direction: "desc" }
        : { key: "due_date", direction: "desc" }
    );
  }, [activeTab]);

  const fetchHistory = async (id: string) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/checklists/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setTaskHistory(data);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const markRowsCompletedLocally = (
    current: typeof paginationData,
    match: (row: ChecklistOccurrence) => boolean,
    completedDate: string
  ) => {
    if (!current?.data) return current;
    let pendingDelta = 0;
    let overdueDelta = 0;
    let completedDelta = 0;
    const data = current.data.map((c) => {
      const row = c as ChecklistOccurrence;
      if (!match(row) || row.display_status === "Completed") return c;
      const prev = row.display_status || getDisplayStatus(row);
      if (prev === "Pending") pendingDelta -= 1;
      if (prev === "Overdue") overdueDelta -= 1;
      completedDelta += 1;
      const due = toDateOnlyString(row.occurrence_due_date || row.due_date) || "";
      return {
        ...row,
        display_status: "Completed",
        completed_date: completedDate,
        is_late_complete: Boolean(completedDate && due && completedDate > due),
      };
    });
    const statusCounts = { ...(current.statusCounts || {}) };
    statusCounts.Pending = Math.max(0, (statusCounts.Pending || 0) + pendingDelta);
    statusCounts.Overdue = Math.max(0, (statusCounts.Overdue || 0) + overdueDelta);
    statusCounts.Delayed = Math.max(0, (statusCounts.Delayed || 0) + overdueDelta);
    statusCounts.Completed = (statusCounts.Completed || 0) + completedDelta;
    return { ...current, data, statusCounts };
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    const occ = selectedTask as ChecklistOccurrence;
    const dueDate =
      toDateOnlyString(occ.occurrence_due_date || occ.due_date) || "";
    if (!dueDate) return;
    const groupId = String(occ.group_id || `chk_${selectedTask.id}`);

    setIsStatusModalOpen(true);
    setActionStatus("loading");
    setActionMessage("Marking completed...");
    setIsSubmittingUpdate(true);

    try {
      const res = await fetch(`/api/checklists/${selectedTask.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed", due_date: dueDate }),
      });

      if (res.ok) {
        const data = await res.json();
        const completedDate =
          data.revision?.timestamp ||
          new Date().toISOString().slice(0, 10);
        rememberLocalCompletions(
          [
            {
              group_id: groupId,
              id: String(selectedTask.id),
              due_date: dueDate,
            },
          ],
          completedDate
        );
        await mutateChecklists(
          (current) =>
            markRowsCompletedLocally(
              current,
              (row) =>
                (String(row.group_id) === groupId ||
                  String(row.id) === String(selectedTask.id)) &&
                toDateOnlyString(row.occurrence_due_date || row.due_date) ===
                  dueDate,
              completedDate
            ),
          { revalidate: false }
        );
        setSelectedTask(null);
        setActionStatus("success");
        setActionMessage("Marked completed!");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        const err = await res.json();
        setActionStatus("error");
        setActionMessage(err.error || "Failed to complete");
        setTimeout(() => setIsStatusModalOpen(false), 3000);
      }
    } catch (error) {
      console.error("Error completing checklist:", error);
      setActionStatus("error");
      setActionMessage("An error occurred while completing");
      setTimeout(() => setIsStatusModalOpen(false), 3000);
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsersList(data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const fetchChecklists = async () => {
    mutateChecklists();
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      id: "",
      task: "",
      assigned_by: (userRole?.toUpperCase() === 'USER' || userRole?.toUpperCase() === 'SALES' || userRole?.toUpperCase() === 'CRM') ? currentUser : "",
      assigned_to: "",
      priority: "Medium",
      department: "",
      frequency: "Daily",
      due_date: "",
      group_id: "",
    });
    setAssignedBySearch("");
    setAssignedToSearch("");
    setDepartmentSearch("");
    setAssignedByOpen(false);
    setAssignedToOpen(false);
    setDepartmentOpen(false);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsModalOpen(false);
    setActionStatus('loading');
    setActionMessage(editingItem ? "Updating Task..." : "Creating Task...");
    setIsStatusModalOpen(true);

    try {
      const dueDate = toDateOnlyString(
        (formData.due_date || "").split(",")[0]?.trim() || formData.due_date || ""
      );
      const payload = {
        task: formData.task || "",
        assigned_by: formData.assigned_by || "",
        assigned_to: formData.assigned_to || "",
        priority: formData.priority || "Medium",
        department: formData.department || "",
        frequency: formData.frequency || "Daily",
        due_date: dueDate,
      };

      if (editingItem) {
        const res = await fetch(`/api/checklists/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to update checklist");
        }
      } else {
        const res = await fetch("/api/checklists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to create checklist");
        }
      }

      resetForm();
      setActiveTab("master");
      await mutateChecklists();
      setActionStatus('success');
      setActionMessage(editingItem ? "Task updated successfully!" : "Task created successfully!");
      setTimeout(() => setIsStatusModalOpen(false), 1500);
    } catch (error: any) {
      console.error("Save error:", error);
      setActionStatus('error');
      setActionMessage(error.message || "An error occurred while saving.");
      mutateChecklists(); 
    } finally {
      setSubmitting(false);
    }
  };


  const handleEdit = (item: Checklist) => {
    setEditingItem(item);
    setFormData({
      ...item,
      due_date: formatDatePickerValue(item.due_date || "")
    });
    setIsModalOpen(true);
  };

  const formatDatePickerValue = (dateStr: string) => {
    if (!dateStr) return "";
    return dateStr.split(',').map(ds => {
      const s = ds.trim();
      // Handle ISO strings (e.g., 2026-03-24T14:30:00.000Z)
      if (s.includes('T')) {
        return s.split('T')[0];
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const parts = s.split("/");
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return s;
    }).join(',');
  };

  const getEarliestDate = (dateStr: string) => {
    if (!dateStr) return null;
    const dates = dateStr.split(',').map(d => d.trim()).filter(Boolean);
    if (dates.length === 0) return null;
    
    const parsedDates = dates.map(ds => {
      let d = new Date(ds);
      if (isNaN(d.getTime()) && ds.includes('/')) {
        const parts = ds.split(' ')[0].split('/');
        if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
      return d;
    }).filter(d => !isNaN(d.getTime()));
    
    if (parsedDates.length === 0) return null;
    return new Date(Math.min(...parsedDates.map(d => d.getTime())));
  };

  const getNextOccurringDay = (dayName: string, baseDateStr?: string) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayIndex = days.indexOf(dayName);
    if (dayIndex === -1) return "";

    // Parse baseDateStr carefully as local date
    let baseDate: Date;
    if (baseDateStr) {
      const [y, m, d] = baseDateStr.split('-').map(Number);
      baseDate = new Date(y, m - 1, d);
    } else {
      baseDate = new Date();
    }
    baseDate.setHours(0,0,0,0);
    const currentDayIndex = baseDate.getDay();

    let diff = dayIndex - currentDayIndex;
    if (diff < 0) {
      diff += 7; // Next occurrence
    }

    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + diff);
    
    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, '0');
    const day = String(nextDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (dateStr: string) => formatDateDdMmmYy(dateStr);

  const handleExport = async () => {
    const exportUrl = checklistSWRKey
      .replace(`page=${currentPage}`, 'page=1')
      .replace(`limit=${itemsPerPage}`, 'limit=100000');
    try {
      const res = await fetch(exportUrl);
      const result = await res.json();
      const allItems: Checklist[] = result.data || [];

      const headers =
        activeTab === "tasks"
          ? ["ID", "Task", "Assigned By", "Assigned To", "Priority", "Department", "Frequency", "Due Date", "Completed Date", "Status", "Group ID"]
          : ["ID", "Task", "Assigned By", "Assigned To", "Priority", "Department", "Frequency", "Due Date", "Group ID"];
      const rows = allItems.map((c: any) =>
        activeTab === "tasks"
          ? [
              c.id,
              c.task,
              c.assigned_by,
              c.assigned_to,
              c.priority,
              c.department,
              c.frequency,
              c.occurrence_due_date || c.due_date,
              c.completed_date || "",
              c.display_status || "",
              c.group_id,
            ]
          : [
              c.id,
              c.task,
              c.assigned_by,
              c.assigned_to,
              c.priority,
              c.department,
              c.frequency,
              c.due_date,
              c.group_id,
            ]
      );

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${val}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `checklists_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const handleDeleteClick = (item: Checklist) => {
    setPendingDeleteId(item.id);
    setIsConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!pendingDeleteId) return;

    setIsConfirmOpen(false);
    setActionStatus('loading');
    setActionMessage("Deleting Task...");
    setIsStatusModalOpen(true);

    try {
      const res = await fetch(`/api/checklists/${pendingDeleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      
      await mutateChecklists();
      setActionStatus('success');
      setActionMessage("Deleted successfully!");
      setTimeout(() => setIsStatusModalOpen(false), 1500);
    } catch (error) {
      console.error("Delete error:", error);
      setActionStatus('error');
      setActionMessage("Failed to delete.");
      mutateChecklists(); 
    } finally {
      setPendingDeleteId(null);
    }
  };

  const getDisplayStatus = (item: Checklist | ChecklistOccurrence) => {
    const occ = item as ChecklistOccurrence;
    if (occ.display_status) return occ.display_status;
    return "Pending";
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <div className="w-3 h-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ?
      <ChevronUpIcon className="w-3 h-3 ml-1 text-[#FFD500]" /> :
      <ChevronDownIcon className="w-3 h-3 ml-1 text-[#FFD500]" />;
  };

  const getPriorityBadge = (priority: string) => {
    const p = priority?.toLowerCase();
    let color = "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
    let Icon = TagIcon;
    
    if (p === 'high') {
      color = "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
      Icon = ExclamationTriangleIcon;
    } else if (p === 'low') {
      color = "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
      Icon = ChevronDownIcon;
    } else if (p === 'medium') {
      color = "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800";
      Icon = ChevronUpIcon;
    }
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md border ${color}`}>
        <Icon className="w-3 h-3" />
        {priority || "Normal"}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    let color = "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
    let Icon = ClockIcon;

    if (s === 'completed') {
      color = "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800";
      Icon = CheckCircleIcon;
    } else if (s === 'approved') {
      color = "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
      Icon = ShieldCheckIcon;
    } else if (s === 'overdue' || s === 'delayed') {
      color = "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
      Icon = ExclamationTriangleIcon;
    } else if (s === 'planned') {
      color = "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
      Icon = CalendarDaysIcon;
    }

    const label =
      s === "overdue" || s === "delayed" ? "Delayed" : status || "Pending";
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md border ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const getDeptBadge = (dept: string) => {
    const d = dept?.toLowerCase();
    let Icon = BuildingOfficeIcon;
    
    if (d?.includes('sales')) Icon = CurrencyDollarIcon;
    else if (d?.includes('marketing')) Icon = ShoppingBagIcon;
    else if (d?.includes('engineering')) Icon = WrenchScrewdriverIcon;
    else if (d?.includes('operations')) Icon = Cog6ToothIcon;
    else if (d?.includes('hr')) Icon = UserGroupIcon;
    else if (d?.includes('finance')) Icon = WalletIcon;
    else if (d?.includes('support')) Icon = LifebuoyIcon;
    else if (d?.includes('management')) Icon = BriefcaseIcon;
    else if (d?.includes('idea')) Icon = LightBulbIcon;
    
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-md">
        <Icon className="w-3 h-3" />
        {dept || "General"}
      </span>
    );
  };

  const renderUserName = (username: string) => {
    if (!username || username === "—") {
      return <span className="font-bold text-gray-500 dark:text-gray-400">—</span>;
    }
    return (
      <span className="font-bold text-gray-900 dark:text-white text-[11px] truncate">
        {username}
      </span>
    );
  };

  const toggleSelectKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rowKeyFor = (item: Checklist | ChecklistOccurrence) => {
    const occ = item as ChecklistOccurrence;
    if (occ.occurrence_key) return String(occ.occurrence_key);
    const due = toDateOnlyString(occ.occurrence_due_date || item.due_date) || "nodue";
    const gid = item.group_id || `chk_${item.id || "x"}`;
    return `${gid}|${due}`;
  };

  const masterRowKey = (item: Checklist, index: number) =>
    String(item.group_id || item.id || `master-${index}`);

  const selectableOnPage = paginatedChecklists.filter((item) => {
    if (activeTab !== "tasks") return false;
    return getDisplayStatus(item) !== "Completed";
  }) as ChecklistOccurrence[];

  const allPageSelected =
    selectableOnPage.length > 0 &&
    selectableOnPage.every((item) => selectedKeys.has(rowKeyFor(item)));

  const toggleSelectAllPage = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        selectableOnPage.forEach((item) => next.delete(rowKeyFor(item)));
      } else {
        selectableOnPage.forEach((item) => next.add(rowKeyFor(item)));
      }
      return next;
    });
  };

  const handleBulkComplete = async () => {
    if (selectedKeys.size === 0 || activeTab !== "tasks" || isBulkCompleting) return;
    const payload = [...selectedKeys]
      .map((key) => {
        const sep = String(key).lastIndexOf("|");
        if (sep < 0) return null;
        const group_id = String(key).slice(0, sep).trim();
        const due = String(key).slice(sep + 1).trim();
        if (group_id && due && /^\d{4}-\d{2}-\d{2}$/.test(due)) {
          return { group_id, due_date: due };
        }
        return null;
      })
      .filter(Boolean) as { group_id: string; due_date: string }[];
    if (payload.length === 0) return;

    setIsBulkCompleting(true);
    try {
      const res = await fetch("/api/checklists/bulk-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk complete failed");
      const completedDate =
        data.completed_date || new Date().toISOString().slice(0, 10);
      rememberLocalCompletions(
        payload.map((p) => ({
          group_id: p.group_id,
          id: p.group_id.replace(/^chk_/, ""),
          due_date: p.due_date,
        })),
        completedDate
      );
      const doneDueByGroup = new Map(
        payload.map((p) => [`${p.group_id}|${p.due_date}`, true] as const)
      );
      await mutateChecklists(
        (current) =>
          markRowsCompletedLocally(
            current,
            (row) => {
              const due =
                toDateOnlyString(row.occurrence_due_date || row.due_date) || "";
              const gid = String(row.group_id || `chk_${row.id}`);
              return (
                doneDueByGroup.has(`${gid}|${due}`) ||
                doneDueByGroup.has(`chk_${row.id}|${due}`) ||
                doneDueByGroup.has(`${row.id}|${due}`) ||
                doneDueByGroup.has(occurrenceKeyOf(row))
              );
            },
            completedDate
          ),
        { revalidate: false }
      );
      setSelectedKeys(new Set());
    } catch (e: any) {
      console.error("Bulk complete failed:", e?.message || e);
    } finally {
      setIsBulkCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sticky Top Header & Filters */}
      <div className="sticky top-0 z-10 bg-[var(--panel-bg)] -mx-2 -mt-2 p-2 pt-0.5 md:-mx-4 md:-mt-4 md:p-4 md:pt-1 border-b border-gray-100 dark:border-white/5 shadow-sm space-y-4">
        {/* Responsive Title Row */}
      <div className="flex flex-col lg:flex-row items-center gap-4 px-1">
        <div className="w-full lg:w-1/3 text-center lg:text-left min-w-0">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">Checklists</h1>
          <p className="text-gray-500 dark:text-slate-300 font-bold text-[8px] md:text-[10px] uppercase tracking-wider">Master tasks + date-wise occurrences</p>
        </div>
        
        <div className="w-full lg:w-1/3 flex justify-center flex-shrink-0 min-w-0">
          <div className="flex items-center gap-1 rounded-full border-2 border-b-4 border-[#003875] dark:border-[#FFD500] bg-white dark:bg-navy-800 shadow-sm transition-all active:translate-y-[2px] active:border-b-2 pl-1 pr-1.5 py-1 overflow-visible">
            <div className="flex items-center bg-gray-50 dark:bg-navy-900 rounded-full p-0.5 border border-gray-100 dark:border-navy-700 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("tasks");
                  setSelectedKeys(new Set());
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeTab === "tasks"
                    ? "bg-[#003875] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                Tasks
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("master");
                  setSelectedKeys(new Set());
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeTab === "master"
                    ? "bg-[#003875] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                Master
              </button>
            </div>

            <div className="h-4 w-[1px] bg-gray-100 dark:bg-white/10 shrink-0" />

            <div className="flex items-center bg-gray-50 dark:bg-navy-900 rounded-full p-0.5 border border-gray-100 dark:border-navy-700 shrink-0">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-[#003875] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="List View"
              >
                <ListBulletIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('tile')}
                className={`p-1.5 rounded-full transition-all ${viewMode === 'tile' ? 'bg-[#003875] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Tile View"
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
            </div>

            <div className="h-4 w-[1px] bg-gray-100 dark:bg-white/10 shrink-0" />

            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-1.5 text-[#003875] dark:text-[#FFD500] px-2 md:px-2.5 py-1.5 font-black transition-colors hover:bg-gray-100 dark:hover:bg-navy-700 uppercase tracking-widest text-[9px] md:text-[10px] rounded-full whitespace-nowrap shrink-0"
              title="Export to CSV"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <div className="h-4 w-[1px] bg-gray-100 dark:bg-white/10 shrink-0" />

            <button
              onClick={() => setIsFilterModalOpen(true)}
              className="flex items-center justify-center gap-1.5 text-[#003875] dark:text-[#FFD500] px-2 md:px-2.5 py-1.5 font-black transition-colors hover:bg-gray-100 dark:hover:bg-navy-700 uppercase tracking-widest text-[9px] md:text-[10px] rounded-full whitespace-nowrap relative shrink-0"
              title="Advanced Filters"
            >
              <FunnelIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
              {(modalStartDate || modalEndDate || modalStatusFilter.length > 0 || modalPriorityFilter.length > 0 || modalAssignedToFilter.length > 0 || modalAssignedByFilter.length > 0 || modalDepartmentFilter.length > 0 || modalFrequencyFilter.length > 0) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-navy-800 animate-pulse" />
              )}
            </button>

            <div className="h-4 w-[1px] bg-gray-100 dark:bg-white/10 shrink-0" />

            <button
              onClick={() => {
                setActiveTab("master");
                resetForm();
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-navy-700 text-[#003875] dark:text-[#FFD500] p-1.5 transition-colors rounded-full shrink-0"
              title="New Checklist"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="hidden lg:block lg:w-1/3"></div>
      </div>

        {/* Search + filters + pagination — one row */}
        <div
          style={{ backgroundColor: "var(--panel-card)", border: "1px solid var(--panel-border)" }}
          className="p-2.5 flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar rounded-2xl shadow-sm"
        >
          <div className="relative group flex-shrink-0 w-[140px] sm:w-[180px]">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-[#FFD500] transition-colors" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 h-[28px] bg-gray-50 dark:bg-navy-900 border border-gray-100 dark:border-navy-700/50 rounded-lg focus:border-[#FFD500] outline-none font-bold text-[12px] text-gray-700 dark:text-white transition-all shadow-sm"
            />
          </div>

          {userRole !== "USER" && (
            <div className="flex items-center bg-gray-100 dark:bg-navy-900 rounded-full p-0.5 border border-gray-200 dark:border-navy-700 flex-shrink-0">
              <button
                onClick={() => {
                  setAssignmentFilter(assignmentFilter === "ToMe" ? "All" : "ToMe");
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all h-[26px] flex items-center gap-1 ${assignmentFilter === "ToMe" ? "bg-[#003875] text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
              >
                To
                <span className={`px-1 rounded-full text-[8px] ${assignmentFilter === "ToMe" ? "bg-white/20" : "bg-gray-200 dark:bg-navy-800"}`}>
                  {toMeCount}
                </span>
              </button>
              <button
                onClick={() => {
                  setAssignmentFilter(assignmentFilter === "ByMe" ? "All" : "ByMe");
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all h-[26px] flex items-center gap-1 ${assignmentFilter === "ByMe" ? "bg-[#003875] text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
              >
                By
                <span className={`px-1 rounded-full text-[8px] ${assignmentFilter === "ByMe" ? "bg-white/20" : "bg-gray-200 dark:bg-navy-800"}`}>
                  {byMeCount}
                </span>
              </button>
            </div>
          )}

          {activeTab === "tasks" &&
            [
              { label: "Pending", icon: <ClockIcon className="w-3 h-3" />, color: "bg-gray-50 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600" },
              { label: "Completed", icon: <CheckCircleIcon className="w-3 h-3" />, color: "bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700" },
              { label: "Delayed", icon: <ExclamationTriangleIcon className="w-3 h-3" />, color: "bg-red-50 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700" },
            ].map((tile) => {
              const count =
                tile.label === "Delayed"
                  ? statusCounts.Delayed || statusCounts.Overdue || 0
                  : statusCounts[tile.label] || 0;
              const isActive = activeStatusFilters.includes(tile.label);
              return (
                <button
                  key={tile.label}
                  onClick={() => {
                    const newFilters = activeStatusFilters.includes(tile.label)
                      ? activeStatusFilters.filter((f) => f !== tile.label)
                      : [...activeStatusFilters, tile.label];
                    setActiveStatusFilters(newFilters);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 h-[28px] ${
                    isActive
                      ? "bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black border-[#003875] dark:border-[#FFD500] shadow-sm"
                      : `${tile.color} hover:shadow-sm`
                  }`}
                >
                  {tile.icon}
                  {tile.label}
                  <span
                    className={`px-1 rounded-full text-[8px] ${
                      isActive ? "bg-white/20 dark:bg-black/20" : "bg-black/5 dark:bg-white/10"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
              Page <span className="text-[#003875] dark:text-[#FFD500]">{currentPage}</span> of {totalPages || 1}
            </p>
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-1.5 py-1 text-[9px] font-bold text-gray-400 hover:text-black dark:hover:text-white disabled:opacity-30 rounded-md">First</button>
            <button onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 text-gray-400 hover:text-black dark:hover:text-white disabled:opacity-30 rounded-md">
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1 text-gray-400 hover:text-black dark:hover:text-white disabled:opacity-30 rounded-md">
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="px-1.5 py-1 text-[9px] font-bold text-gray-400 hover:text-black dark:hover:text-white disabled:opacity-30 rounded-md">Last</button>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent border-none p-0 text-[10px] font-bold outline-none dark:text-white cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <div
        style={{ borderColor: "var(--panel-border)" }}
        className="rounded-2xl border overflow-hidden shadow-sm transition-all duration-500"
      >
        {viewMode === 'list' ? (
          /* Table View - Scrollable on mobile */
          <div 
            style={{ backgroundColor: 'var(--panel-card)' }}
            className="overflow-x-auto no-scrollbar transition-colors duration-500 min-h-[400px] w-full"
          >
            <table className="w-full text-left border-collapse table-auto min-w-[800px]">
            <thead>
              <tr className="bg-[#003875] dark:bg-navy-950 text-white dark:text-slate-200 whitespace-nowrap">
                {activeTab === "master" && (
                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest w-[72px]">
                    Actions
                  </th>
                )}
                {activeTab === "tasks" && (
                  <th className="px-2 py-3 text-center w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAllPage}
                      className={`mx-auto w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        allPageSelected
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-white/50 hover:border-white"
                      }`}
                      title="Select all pending on page"
                    >
                      {allPageSelected && <CheckIcon className="w-3 h-3" />}
                    </button>
                  </th>
                )}
                {activeTab === "master" && (
                  <th onClick={() => handleSort('id')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors">
                    <div className="flex items-center">ID <SortIcon column="id" /></div>
                  </th>
                )}
                <th onClick={() => handleSort('task')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors min-w-[220px]">
                  <div className="flex items-center">Task <SortIcon column="task" /></div>
                </th>
                <th onClick={() => handleSort('assigned_to')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden sm:table-cell min-w-[120px]">
                  <div className="flex items-center">Assigned To <SortIcon column="assigned_to" /></div>
                </th>
                <th onClick={() => handleSort('assigned_by')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden sm:table-cell min-w-[120px]">
                  <div className="flex items-center">Assigned By <SortIcon column="assigned_by" /></div>
                </th>
                <th onClick={() => handleSort('department')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden md:table-cell">
                  <div className="flex items-center">Dept <SortIcon column="department" /></div>
                </th>
                <th onClick={() => handleSort('priority')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden sm:table-cell">
                  <div className="flex items-center">Priority <SortIcon column="priority" /></div>
                </th>
                <th onClick={() => handleSort('frequency')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden xl:table-cell">
                  <div className="flex items-center">Freq <SortIcon column="frequency" /></div>
                </th>
                <th onClick={() => handleSort('due_date')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors whitespace-nowrap">
                  <div className="flex items-center">Due <SortIcon column="due_date" /></div>
                </th>
                {activeTab === "tasks" && (
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                    Status
                  </th>
                )}
                {activeTab === "tasks" && (
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                    Completed
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={activeTab === "tasks" ? 10 : 9} className="px-4 py-10 text-center">
                    <div className="w-6 h-6 border-2 border-gray-100 border-t-[#FFD500] rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[8px]">Syncing...</p>
                  </td>
                </tr>
              ) : paginatedChecklists.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === "tasks" ? 10 : 9} className="px-4 py-10 text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No checklists found</p>
                  </td>
                </tr>
              ) : (
                paginatedChecklists.map((item, index) => {
                  const occ = item as ChecklistOccurrence;
                  const late =
                    activeTab === "tasks" && Boolean(occ.is_late_complete);
                  const rowKey =
                    activeTab === "tasks"
                      ? rowKeyFor(item)
                      : masterRowKey(item, index);
                  const reactKey = `${rowKey}__${index}`;
                  const isSelected = selectedKeys.has(rowKey);
                  const isCompleted = getDisplayStatus(item) === "Completed";
                  return (
                  <tr
                    key={reactKey}
                    className={`border-b-2 border-gray-200 dark:border-white/10 last:border-0 transition-colors group ${
                      late
                        ? "bg-red-50/80 dark:bg-red-950/30 hover:bg-red-100/80 dark:hover:bg-red-900/40"
                        : isSelected
                          ? "bg-emerald-50/60 dark:bg-emerald-900/15"
                          : "hover:bg-orange-50/10"
                    }`}
                  >
                    {activeTab === "master" && (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {(['ADMIN', 'EA'].includes(userRole?.toUpperCase()) ||
                            item.assigned_by === currentUser) && (
                            <>
                              <button
                                onClick={() => handleEdit(item)}
                                className="p-1.5 bg-[#003875]/10 text-[#003875] dark:bg-[#FFD500]/10 dark:text-[#FFD500] hover:bg-[#003875] hover:text-white dark:hover:bg-[#FFD500] dark:hover:text-black rounded-lg transition-all"
                                title="Edit"
                              >
                                <PencilSquareIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(item)}
                                className="p-1.5 bg-[#CE2029]/10 text-[#CE2029] hover:bg-[#CE2029] hover:text-white rounded-lg transition-all"
                                title="Delete"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                    {activeTab === "tasks" && (
                      <td className="px-2 py-3 text-center">
                        {isCompleted ? (
                          <span
                            className="mx-auto w-5 h-5 rounded-full bg-[#003875] border-2 border-[#003875] text-white flex items-center justify-center opacity-90 cursor-not-allowed"
                            title="Already completed"
                          >
                            <CheckIcon className="w-3 h-3" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleSelectKey(rowKey)}
                            className={`mx-auto w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-gray-300 dark:border-white/30 hover:border-emerald-500"
                            }`}
                          >
                            {isSelected && <CheckIcon className="w-3 h-3" />}
                          </button>
                        )}
                      </td>
                    )}
                    {activeTab === "master" && (
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] text-gray-400 font-bold">#{item.id}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 min-w-[260px] max-w-[420px]">
                      <p className="font-black text-sm text-gray-900 dark:text-white leading-snug whitespace-normal break-words">
                        {item.task || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {renderUserName(item.assigned_to)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {renderUserName(item.assigned_by)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {getDeptBadge(item.department)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">{getPriorityBadge(item.priority)}</td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800 text-[10px] font-black uppercase tracking-widest rounded-md">
                        <CalendarDaysIcon className="w-3 h-3" />
                        {item.frequency?.includes(':') ? (
                          <span className="flex items-center gap-1">
                            {item.frequency.split(':')[0]}
                            <span className="w-1 h-1 rounded-full bg-indigo-300" />
                            {item.frequency.split(':')[1]}
                          </span>
                        ) : (item.frequency || "Daily")}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-gray-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDateDisplay(
                          activeTab === "tasks"
                            ? occ.occurrence_due_date || item.due_date
                            : item.due_date
                        ) || "—"}
                      </span>
                    </td>
                    {activeTab === "tasks" && (
                      <td className="px-4 py-3">{getStatusBadge(getDisplayStatus(item))}</td>
                    )}
                    {activeTab === "tasks" && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] font-bold text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          {formatDateDisplay(occ.completed_date || "") || "—"}
                        </span>
                      </td>
                    )}
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Tile View */
        <div className="p-2 bg-gray-50/20 dark:bg-navy-950/20 min-h-[400px] w-full overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-gray-100 border-t-[#FFD500] rounded-full animate-spin mb-4" />
              <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Syncing Checklists...</p>
            </div>
          ) : paginatedChecklists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/50 dark:bg-navy-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/5">
              <DocumentTextIcon className="w-10 h-10 text-gray-200 dark:text-white/10 mb-2" />
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No checklists found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedChecklists.map((item, index) => {
                const occ = item as ChecklistOccurrence;
                const status = getDisplayStatus(item);
                const late = activeTab === "tasks" && Boolean(occ.is_late_complete);
                const statusColorMap: Record<string, string> = {
                  "Pending": "border-gray-200 dark:border-gray-700",
                  "Completed": "border-emerald-200 dark:border-emerald-900/50",
                  "Overdue": "border-red-200 dark:border-red-900/50",
                  "Delayed": "border-red-200 dark:border-red-900/50",
                };
                const borderColor = late
                  ? "border-red-300 dark:border-red-800"
                  : statusColorMap[status] || "border-gray-100 dark:border-white/5";
                const rowKey =
                  activeTab === "tasks"
                    ? rowKeyFor(item)
                    : masterRowKey(item, index);
                const reactKey = `${rowKey}__${index}`;
                const isSelected = selectedKeys.has(rowKey);

                return (
                  <div 
                    key={reactKey}
                    className={`group rounded-2xl border-4 ${borderColor} shadow-sm hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300 overflow-hidden flex flex-col h-full ${
                      late
                        ? "bg-red-50/80 dark:bg-red-950/30"
                        : isSelected
                          ? "bg-emerald-50/80 dark:bg-emerald-900/20"
                          : "bg-white dark:bg-navy-900"
                    }`}
                  >
                    <div className="p-3 md:p-4 border-b border-gray-50 dark:border-white/5 flex items-start justify-between gap-3 bg-gray-50/30 dark:bg-white/5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {activeTab === "master" && (
                            <span className="font-mono text-[9px] font-black text-[#003875] dark:text-[#FFD500] bg-[#003875]/5 dark:bg-[#FFD500]/10 px-1.5 py-0.5 rounded">#{item.id}</span>
                          )}
                          {getPriorityBadge(item.priority)}
                        </div>
                        <h3 className="font-black text-sm text-gray-900 dark:text-white leading-snug whitespace-normal break-words group-hover:text-[#003875] dark:group-hover:text-[#FFD500] transition-colors">{item.task || "—"}</h3>
                      </div>
                      {activeTab === "tasks" && (
                        <div className="flex-shrink-0">
                          {getStatusBadge(status)}
                        </div>
                      )}
                    </div>

                    <div className="p-3 md:p-4 flex-1 flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3 mt-auto">
                        <div className="flex flex-col gap-1.5 overflow-hidden">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Assigned To</span>
                          {renderUserName(item.assigned_to)}
                        </div>
                        <div className="flex flex-col gap-1 overflow-hidden">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Dept</span>
                          <div className="scale-75 origin-left">
                            {getDeptBadge(item.department)}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 overflow-hidden">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Due Date</span>
                          <span className="text-[10px] font-black text-gray-700 dark:text-slate-300 truncate">
                            {formatDateDisplay(
                              activeTab === "tasks"
                                ? occ.occurrence_due_date || item.due_date
                                : item.due_date
                            ) || "—"}
                          </span>
                        </div>
                        {activeTab === "tasks" ? (
                          <div className="flex flex-col gap-1 overflow-hidden">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Completed</span>
                            <span className="text-[10px] font-black text-gray-700 dark:text-slate-300 truncate">
                              {formatDateDisplay(occ.completed_date || "") || "—"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 overflow-hidden">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Assigned By</span>
                            {renderUserName(item.assigned_by)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-2 md:p-3 bg-gray-50/50 dark:bg-white/5 border-t border-gray-50 dark:border-white/5 flex items-center justify-between gap-2">
                      {activeTab === "tasks" ? (
                        status === "Completed" ? (
                          <span
                            className="w-5 h-5 rounded-full bg-[#003875] border-2 border-[#003875] text-white flex items-center justify-center opacity-90 cursor-not-allowed"
                            title="Already completed"
                          >
                            <CheckIcon className="w-3 h-3" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleSelectKey(rowKey)}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-gray-300 dark:border-white/30 hover:border-emerald-500"
                            }`}
                          >
                            {isSelected && <CheckIcon className="w-3 h-3" />}
                          </button>
                        )
                      ) : (
                        <div className="flex-1" />
                      )}
                      {activeTab === "master" &&
                        (['ADMIN', 'EA'].includes(userRole?.toUpperCase()) ||
                          item.assigned_by === currentUser) && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 bg-[#003875]/10 text-[#003875] dark:bg-[#FFD500]/10 dark:text-[#FFD500] hover:bg-[#003875] hover:text-white dark:hover:bg-[#FFD500] dark:hover:text-black rounded-xl transition-all"
                              title="Edit"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(item)}
                              className="p-1.5 bg-[#CE2029]/10 text-[#CE2029] hover:bg-[#CE2029] hover:text-white rounded-xl transition-all"
                              title="Delete"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Bulk complete overlay — above footer */}
      {activeTab === "tasks" && (selectedKeys.size > 0 || isBulkCompleting) && (
        <div className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
          <button
            type="button"
            onClick={handleBulkComplete}
            disabled={isBulkCompleting}
            className="pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-white font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-emerald-500/40 border-2 border-b-4 border-emerald-700 hover:bg-emerald-400 active:translate-y-[2px] active:border-b-2 disabled:opacity-90 disabled:cursor-wait transition-all"
          >
            {isBulkCompleting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Completing…
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Complete {selectedKeys.size}
              </>
            )}
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <Portal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-[#FFFBF0] dark:bg-navy-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-orange-100/50 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-4 border-b border-orange-100/50 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  {editingItem ? "Edit Checklist" : "New Checklist"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-gray-400 dark:text-slate-400 font-bold text-[8px] uppercase tracking-widest">Task Configuration</p>
                  {editingItem && (
                    <span className="px-2 py-0.5 bg-orange-50 dark:bg-zinc-800 text-[8px] font-black text-gray-500 rounded border border-orange-100 dark:border-zinc-700">
                      ID: {editingItem.id}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
              >
                <XMarkIcon className="w-8 h-8" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-6 max-h-[80vh] overflow-y-auto bg-white dark:bg-navy-800/50">
              {/* Task */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#FFD500] uppercase tracking-widest block">Task Description</label>
                <textarea
                  value={formData.task}
                  onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                  className="w-full bg-[#FFFBF0] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-orange-100 dark:border-zinc-800 focus:border-[#FFD500] focus:bg-white dark:focus:bg-zinc-900 outline-none font-bold text-xs text-gray-800 dark:text-zinc-100 transition-all shadow-sm min-h-[80px]"
                  required
                  rows={2}
                  placeholder="Enter task description..."
                />
              </div>

              {/* Row 1: Assigned By + Assigned To */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assigned By Searchable Dropdown */}
                <div className="relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Assigned By</label>
                  <div 
                    className={`w-full bg-[#FFFBF0] dark:bg-zinc-900 border border-orange-100 dark:border-zinc-800 rounded-lg shadow-sm ${userRole?.toUpperCase() === 'USER' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                    onClick={() => {
                      if (userRole?.toUpperCase() !== 'USER') {
                        setAssignedByOpen(!assignedByOpen);
                        setAssignedToOpen(false);
                        setDepartmentOpen(false);
                      }
                    }}
                  >
                    <div className="px-3 py-1.5 font-bold text-xs text-gray-800 dark:text-zinc-100 flex justify-between items-center hover:border-[#FFD500] transition-colors">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formData.assigned_by || (userRole?.toUpperCase() === 'USER' ? currentUser : "Select User...")}</span>
                      </div>
                      {userRole?.toUpperCase() !== 'USER' && <ChevronDownIcon className="w-3 h-3 text-gray-400" />}
                    </div>
                  </div>
                  {assignedByOpen && userRole?.toUpperCase() !== 'USER' && (
                    <div className="absolute z-[10000] w-full mt-1 bg-white dark:bg-zinc-900 border border-orange-100 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-2 border-b border-orange-50 dark:border-zinc-800">
                        <input 
                          type="text" 
                          placeholder="Search users..." 
                          value={assignedBySearch}
                          onChange={(e) => setAssignedBySearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-gray-50 dark:bg-zinc-950 px-2 py-1 rounded border border-gray-100 dark:border-zinc-800 outline-none text-[10px] font-bold text-gray-700 dark:text-gray-300"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {usersList.filter(u => ['ADMIN', 'EA'].includes(u.role_name?.toUpperCase() || '') && u.username.toLowerCase().includes(assignedBySearch.toLowerCase())).map(u => (
                          <div key={`by-${u.username || `id-${u.id}`}`}
                            className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 cursor-pointer"
                            onClick={() => { 
                              setFormData({ ...formData, assigned_by: u.username }); 
                              setAssignedByOpen(false); 
                              setAssignedBySearch(""); 
                            }}
                          >{u.username}</div>
                        ))}
                        {usersList.filter(u => ['ADMIN', 'EA'].includes(u.role_name?.toUpperCase() || '') && u.username.toLowerCase().includes(assignedBySearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-[10px] text-gray-400 text-center">No users found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assigned To Searchable Dropdown */}
                <div className="relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Assigned To</label>
                  <div 
                    className="w-full bg-[#FFFBF0] dark:bg-zinc-900 border border-orange-100 dark:border-zinc-800 rounded-lg shadow-sm cursor-pointer"
                    onClick={() => {
                      setAssignedToOpen(!assignedToOpen);
                      setAssignedByOpen(false);
                      setDepartmentOpen(false);
                    }}
                  >
                    <div className="px-3 py-1.5 font-bold text-xs text-gray-800 dark:text-zinc-100 flex justify-between items-center hover:border-[#FFD500] transition-colors">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formData.assigned_to || "Select User..."}</span>
                      </div>
                      <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                    </div>
                  </div>
                  {assignedToOpen && (
                    <div className="absolute z-[10000] w-full mt-1 bg-white dark:bg-zinc-900 border border-orange-100 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-2 border-b border-orange-50 dark:border-zinc-800">
                        <input 
                          type="text" 
                          placeholder="Search users..." 
                          value={assignedToSearch}
                          onChange={(e) => setAssignedToSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-gray-50 dark:bg-zinc-950 px-2 py-1 rounded border border-gray-100 dark:border-zinc-800 outline-none text-[10px] font-bold text-gray-700 dark:text-gray-300"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {usersList.filter(u => u.username.toLowerCase().includes(assignedToSearch.toLowerCase())).map(u => (
                          <div key={`to-${u.username || `id-${u.id}`}`}
                            className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 cursor-pointer"
                            onClick={() => { 
                              setFormData({ ...formData, assigned_to: u.username }); 
                              setAssignedToOpen(false); 
                              setAssignedToSearch(""); 
                            }}
                          >{u.username}</div>
                        ))}
                        {usersList.filter(u => u.username.toLowerCase().includes(assignedToSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-[10px] text-gray-400 text-center">No users found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Department + Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Department Searchable Dropdown */}
                <div className="relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Department</label>
                  <div 
                    className="w-full bg-[#FFFBF0] dark:bg-zinc-900 border border-orange-100 dark:border-zinc-800 rounded-lg shadow-sm cursor-pointer"
                    onClick={() => { 
                      setDepartmentOpen(!departmentOpen); 
                      setAssignedByOpen(false); 
                      setAssignedToOpen(false); 
                    }}
                  >
                    <div className="px-3 py-1.5 font-bold text-xs text-gray-800 dark:text-zinc-100 flex justify-between items-center hover:border-[#FFD500] transition-colors">
                      <div className="flex items-center gap-2">
                        <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formData.department || "Select Department..."}</span>
                      </div>
                      <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                    </div>
                  </div>
                  {departmentOpen && (
                    <div className="absolute z-[10000] w-full mt-1 bg-white dark:bg-zinc-900 border border-orange-100 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-2 border-b border-orange-50 dark:border-zinc-800">
                        <input 
                          type="text" 
                          placeholder="Search departments..." 
                          value={departmentSearch}
                          onChange={(e) => setDepartmentSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-gray-50 dark:bg-zinc-950 px-2 py-1 rounded border border-gray-100 dark:border-zinc-800 outline-none text-[10px] font-bold text-gray-700 dark:text-gray-300"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {predefinedDepartments.filter(d => d.toLowerCase().includes(departmentSearch.toLowerCase())).map(d => (
                          <div key={`dept-${d}`}
                            className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 cursor-pointer"
                            onClick={() => { 
                              setFormData({ ...formData, department: d }); 
                              setDepartmentOpen(false); 
                              setDepartmentSearch(""); 
                            }}
                          >{d}</div>
                        ))}
                        {predefinedDepartments.filter(d => d.toLowerCase().includes(departmentSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer flex items-center gap-2"
                            onClick={() => { 
                              setFormData({ ...formData, department: departmentSearch }); 
                              setDepartmentOpen(false); 
                              setDepartmentSearch(""); 
                            }}
                          ><PlusIcon className="w-3 h-3" /> Add "{departmentSearch}"</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Priority</label>
                  <div className="flex bg-gray-100 dark:bg-zinc-900/50 p-1 rounded-xl">
                    {(['Low', 'Medium', 'High'] as const).map((pri) => (
                      <button key={pri} type="button"
                        onClick={() => setFormData({ ...formData, priority: pri })}
                        className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          formData.priority === pri 
                            ? pri === 'Low' ? 'bg-green-500 text-white shadow-md'
                            : pri === 'Medium' ? 'bg-yellow-500 text-white shadow-md'
                            : 'bg-red-500 text-white shadow-md'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >{pri}</button>
                    ))}
                  </div>
                </div>
              </div>

              {(
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Frequency</label>
                    <div className="flex flex-nowrap overflow-x-auto pb-1.5 gap-1.5 custom-scrollbar no-scrollbar">
                      {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half Yearly', 'Yearly'].map((freq) => {
                        const isSelected = formData.frequency?.startsWith(freq);
                        return (
                          <button
                            key={freq}
                            type="button"
                            onClick={() => {
                              if (freq === 'Weekly') {
                                if (!formData.frequency?.startsWith('Weekly')) {
                                  const nextDayStr = getNextOccurringDay('Mon', formData.due_date);
                                  setFormData({ ...formData, frequency: 'Weekly: Mon', due_date: nextDayStr });
                                }
                              } else {
                                setFormData({ ...formData, frequency: freq, due_date: "" });
                              }
                            }}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all border whitespace-nowrap shadow-sm flex-shrink-0 ${
                              isSelected 
                                ? 'bg-[#FFD500] text-black border-[#FFD500] shadow-[#FFD500]/20' 
                                : 'bg-white dark:bg-zinc-900 text-gray-500 border-orange-50 dark:border-zinc-800 hover:border-[#FFD500] hover:text-[#003875] dark:hover:text-[#FFD500]'
                            }`}
                          >
                            {freq}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formData.frequency?.startsWith('Weekly') && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-300 border-t border-orange-50 dark:border-zinc-800/50 pt-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Select Days (Next occurrence set automatically)</p>
                      <div className="flex flex-wrap gap-2.5">
                        {[
                          { label: 'M', value: 'Mon', full: 'Monday' },
                          { label: 'T', value: 'Tue', full: 'Tuesday' },
                          { label: 'W', value: 'Wed', full: 'Wednesday' },
                          { label: 'T', value: 'Thu', full: 'Thursday' },
                          { label: 'F', value: 'Fri', full: 'Friday' },
                          { label: 'S', value: 'Sat', full: 'Saturday' }
                        ].map((day) => {
                          const currentFreq = formData.frequency || "";
                          const prefix = "Weekly: ";
                          const activeDays = currentFreq.startsWith(prefix) 
                            ? currentFreq.slice(prefix.length).split(',').map(d => d.trim()) 
                            : [];
                          const isDaySelected = activeDays.includes(day.value);

                          return (
                            <button
                              key={day.value}
                              type="button"
                              title={day.full}
                              onClick={() => {
                                let newDays;
                                if (isDaySelected) {
                                  newDays = activeDays.filter(d => d !== day.value);
                                } else {
                                  newDays = [...activeDays, day.value];
                                }
                                
                                const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                newDays.sort((a,b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
                                
                                const newValue = newDays.length > 0 ? prefix + newDays.join(',') : 'Daily';
                                
                                // Anchor = soonest next selected weekday (date only)
                                const nextDates = newDays
                                  .map((d) => getNextOccurringDay(d))
                                  .filter(Boolean)
                                  .sort();
                                const nextDateStr = nextDates[0] || "";
                                setFormData({ ...formData, frequency: newValue, due_date: nextDateStr });
                              }}
                              className={`w-9 h-9 rounded-full flex flex-col items-center justify-center transition-all border shadow-sm ${
                                isDaySelected
                                  ? 'bg-[#CE2029] text-white border-[#CE2029] shadow-[#CE2029]/20 scale-110'
                                  : 'bg-gray-50 dark:bg-zinc-800 text-gray-400 border-orange-50 dark:border-zinc-700 hover:border-[#CE2029] hover:text-[#CE2029]'
                              }`}
                            >
                              <span className="text-[10px] font-black">{day.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Anchor due date (date only) */}
              <div className="border-t border-orange-50 dark:border-zinc-800/50 pt-4">
                <PremiumDatePicker
                  label={editingItem ? "Anchor Due Date" : "Start / Due Date"}
                  value={(formData.due_date || "").split(",")[0] || ""}
                  onChange={(val) =>
                    setFormData({
                      ...formData,
                      due_date: toDateOnlyString(String(val).split(",")[0] || val) || String(val).split(",")[0] || "",
                    })
                  }
                  multiSelect={false}
                  allowPast={false}
                  allowSundays={true}
                />
                <p className="text-[10px] text-gray-400 font-semibold mt-1">
                  Saved as date only. Tasks tab expands by frequency through today.
                </p>
              </div>

              <div className="p-4 border-t border-orange-100/50 dark:border-zinc-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl font-black text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all uppercase tracking-widest text-[10px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#CE2029] hover:bg-[#8E161D] text-white px-4 py-2 rounded-xl font-black transition-all shadow-lg active:scale-95 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      <span>{editingItem ? "Saving..." : "Creating..."}</span>
                    </>
                  ) : (
                    editingItem ? "Save" : "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

        {/* Follow Up Right Sidebar Drawer */}
        {selectedTask && (
          <Portal>
          <div className="fixed inset-0 z-[99999] overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
              onClick={() => setSelectedTask(null)}
            />
            
            {/* Sidebar Content */}
            <div className="absolute top-0 right-0 h-full w-full max-w-md bg-white dark:bg-navy-900 shadow-[-20px_0_50px_-12px_rgba(0,0,0,0.3)] flex flex-col animate-in slide-in-from-right duration-500 ease-out border-l border-gray-100 dark:border-white/5">
              {/* Header */}
              <div className="py-3 px-6 flex items-start justify-between bg-[#CE2029] shadow-lg shadow-red-900/10">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="p-2.5 bg-white/10 rounded-xl text-white backdrop-blur-md border border-white/20 shrink-0 mt-1">
                    <ArrowPathIcon className="w-6 h-6 animate-spin-slow" />
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-black text-white tracking-tight">Follow Up</h2>
                      <span className="text-[10px] font-mono text-white bg-white/10 px-2 py-0.5 rounded border border-white/20 uppercase tracking-widest font-black shrink-0">#{selectedTask.id}</span>
                    </div>
                    <p className="text-[10px] font-black text-white/90 uppercase tracking-widest leading-normal break-words">
                      {selectedTask.task}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/70 hover:text-white group shrink-0 ml-2"
                >
                  <XMarkIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>

              {/* Body Content */}
              <div className="flex-1 overflow-y-auto px-6 pt-1 pb-6 space-y-3 custom-scrollbar">
                {/* Task Details and Badges */}
                <section className="space-y-4">
                  <div className="p-4 bg-red-50/30 dark:bg-red-900/10 rounded-2xl border border-red-100/50 dark:border-red-900/30">
                    <p className="text-gray-700 dark:text-slate-300 font-bold text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedTask.task}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(getDisplayStatus(selectedTask))}
                    {getPriorityBadge(selectedTask.priority)}
                    {getDeptBadge(selectedTask.department)}
                  </div>
                </section>

                {/* Compact Details Grid */}
                <div className="bg-red-50/30 dark:bg-red-900/10 rounded-2xl border border-red-100/50 dark:border-red-900/30 overflow-hidden divide-y divide-red-100/30 dark:divide-red-900/20">
                  {/* Row 1: Stakeholders */}
                  <div className="grid grid-cols-2">
                    <div className="p-3 border-r border-gray-100 dark:border-white/5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-900 dark:bg-[#FFD500] flex items-center justify-center text-white dark:text-black text-[10px] font-black">
                        {selectedTask.assigned_to?.substring(0, 2).toUpperCase() || "TO"}
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-1">Assigned To</p>
                        <p className="text-xs font-black text-gray-900 dark:text-white truncate max-w-[120px]">{selectedTask.assigned_to}</p>
                      </div>
                    </div>
                    <div className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 text-[10px] font-black">
                        {selectedTask.assigned_by?.substring(0, 2).toUpperCase() || "BY"}
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-1">Assigned By</p>
                        <p className="text-xs font-bold text-gray-600 dark:text-slate-400 truncate max-w-[120px]">{selectedTask.assigned_by}</p>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Dept & Due Date */}
                  <div className="grid grid-cols-2">
                    <div className="p-3 border-r border-gray-100 dark:border-white/5 flex items-center gap-3">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                        <TagIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Department</p>
                        <p className="text-xs font-black text-gray-900 dark:text-white">{selectedTask.department}</p>
                      </div>
                    </div>
                    <div className="p-3 flex items-center gap-3">
                      <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600">
                        <CalendarDaysIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Due Date</p>
                        <p className="text-xs font-black text-gray-900 dark:text-white">{formatDateDisplay(selectedTask.due_date)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Timestamps */}
                  <div className="grid grid-cols-2">
                    <div className="p-3 border-r border-gray-100 dark:border-white/5 flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
                        <ClockIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Registered</p>
                        <p className="text-[10px] font-bold text-gray-600 dark:text-slate-400">{formatDateDisplay(selectedTask.created_at)}</p>
                      </div>
                    </div>
                    {selectedTask.updated_at && (
                      <div className="p-3 flex items-center gap-3">
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600">
                          <ArrowPathIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Updated</p>
                          <p className="text-[10px] font-bold text-gray-600 dark:text-slate-400">{formatDateDisplay(selectedTask.updated_at)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Complete only */}
                <div className="space-y-4 border-t border-gray-100 dark:border-white/5 pt-6 pb-2">
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-950/40 border border-gray-100 dark:border-white/5">
                      <p className="font-black uppercase tracking-widest text-gray-400 mb-1">Due</p>
                      <p className="font-bold text-gray-800 dark:text-white">
                        {formatDateDisplay(
                          (selectedTask as ChecklistOccurrence).occurrence_due_date ||
                            selectedTask.due_date
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-950/40 border border-gray-100 dark:border-white/5">
                      <p className="font-black uppercase tracking-widest text-gray-400 mb-1">Completed</p>
                      <p className="font-bold text-gray-800 dark:text-white">
                        {formatDateDisplay(
                          (selectedTask as ChecklistOccurrence).completed_date || ""
                        ) || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Completion History */}
                <div className="pt-8 border-t border-gray-100 dark:border-white/5 pb-10 w-full">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 px-1">
                    <ClockIcon className="w-4 h-4 text-blue-500" /> Completion History
                  </h4>
                  
                  {isLoadingHistory ? (
                    <div className="flex flex-col items-center justify-center py-8 opacity-40">
                      <ArrowPathIcon className="w-6 h-6 animate-spin mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Fetching history...</p>
                    </div>
                  ) : taskHistory.length > 0 ? (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100 dark:before:bg-white/5">
                      {taskHistory.map((item, index) => (
                        <div key={`${item.due_date}-${item.timestamp}-${index}`} className="relative">
                          <div className="absolute -left-[30px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-navy-900 z-10 bg-emerald-500" />
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                {item.new_status || "Completed"}
                              </span>
                              <span className="text-[8px] font-bold text-gray-400">
                                {formatDateDisplay(item.timestamp || item.created_at)}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-slate-500 bg-emerald-50/30 dark:bg-emerald-900/5 p-3 rounded-xl border border-emerald-100/30 dark:border-emerald-900/20">
                              Due: <b>{formatDateDisplay(item.due_date)}</b>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 opacity-30 select-none">
                      <SparklesIconOutline className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No completions yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Footer Actions */}
              <div className="p-5 px-6 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-navy-900 flex gap-4 mt-auto sticky bottom-0 z-30 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
                <button
                  onClick={handleCompleteTask}
                  disabled={
                    isSubmittingUpdate ||
                    getDisplayStatus(selectedTask) === "Completed"
                  }
                  className="w-full px-4 py-3.5 bg-[#CE2029] hover:bg-red-700 disabled:bg-gray-300 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 no-underline border-none"
                >
                  {isSubmittingUpdate ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="w-5 h-5" />
                  )}
                  Mark Completed
                </button>
              </div>
            </div>
          </div>
          </Portal>
        )}

      {/* Action Status Modal */}
      <Portal>
      <ActionStatusModal
        isOpen={isStatusModalOpen}
        status={actionStatus}
        message={actionMessage}
      />
      </Portal>

      {/* Confirm Delete Modal */}
      <Portal>
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Delete Checklist Item"
        message="Are you sure you want to delete this checklist item? This action cannot be undone."
        onConfirm={() => {
          performDelete();
        }}
        onClose={() => {
          setIsConfirmOpen(false);
          setPendingDeleteId(null);
        }}
      />
      </Portal>

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <Portal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsFilterModalOpen(false)} />
          <div className="relative bg-[#FFFBF0] dark:bg-navy-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border-4 border-[#003875] dark:border-[#FFD500] overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div className="bg-[#003875] dark:bg-[#FFD500] p-6 border-b-4 border-orange-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white dark:text-[#003875] tracking-tight uppercase">Advanced Filters</h2>
                <p className="text-white/60 dark:text-[#003875]/60 font-bold text-[10px] uppercase tracking-widest mt-0.5">Refine Checklist View</p>
              </div>
              <button onClick={() => setIsFilterModalOpen(false)} className="p-2 bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20 rounded-full transition-colors">
                <XMarkIcon className="w-6 h-6 text-white dark:text-[#003875]" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white dark:bg-navy-900/50">
              {/* Date Range */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                  <CalendarDaysIcon className="w-4 h-4 text-[#003875] dark:text-[#FFD500]" /> Due Date Range
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Start Date</span>
                    <div className="relative group/date">
                      <CalendarDaysIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none group-focus-within/date:text-[#003875] dark:group-focus-within/date:text-[#FFD500]" />
                      <input 
                        type="date" value={modalStartDate} onChange={(e) => setModalStartDate(e.target.value)}
                        className="w-full bg-[#FFFBF0] dark:bg-navy-900 border-2 border-orange-50 dark:border-navy-700 rounded-xl pl-3 pr-10 py-2 text-xs font-bold outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">End Date</span>
                    <div className="relative group/date">
                      <CalendarDaysIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none group-focus-within/date:text-[#003875] dark:group-focus-within/date:text-[#FFD500]" />
                      <input 
                        type="date" value={modalEndDate} onChange={(e) => setModalEndDate(e.target.value)}
                        className="w-full bg-[#FFFBF0] dark:bg-navy-900 border-2 border-orange-50 dark:border-navy-700 rounded-xl pl-3 pr-10 py-2 text-xs font-bold outline-none focus:border-[#003875] dark:focus:border-[#FFD500] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Status Filter */}
                <div className="relative">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Status</label>
                  <div 
                    className="w-full bg-[#FFFBF0] dark:bg-navy-900 border-2 border-orange-50 dark:border-navy-700 rounded-xl px-4 py-2.5 cursor-pointer flex justify-between items-center hover:border-[#003875] dark:hover:border-[#FFD500] transition-colors shadow-sm"
                    onClick={() => {
                        setModalStatusOpen(!modalStatusOpen);
                         setModalPriorityOpen(false);
                         setModalAssignedToOpen(false);
                         setModalAssignedByOpen(false);
                         setModalDepartmentOpen(false);
                         setModalFrequencyOpen(false);
                    }}
                  >
                    <span className="text-xs font-bold truncate">
                      {modalStatusFilter.length > 0 ? `${modalStatusFilter.length} Selected` : "All Statuses"}
                    </span>
                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${modalStatusOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {modalStatusOpen && (
                    <div className="absolute z-[10000] w-full mt-2 bg-white dark:bg-navy-900 border-2 border-[#003875] dark:border-[#FFD500] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="p-2 border-b border-orange-50 dark:border-navy-700">
                        <input 
                          type="text" placeholder="Search status..." value={modalStatusSearch}
                          onChange={(e) => setModalStatusSearch(e.target.value)}
                          className="w-full bg-[#FFFBF0] dark:bg-navy-950 px-3 py-1.5 rounded-lg border-none outline-none text-xs font-bold"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                        {['Pending', 'Completed', 'Delayed']
                          .filter(s => s.toLowerCase().includes(modalStatusSearch.toLowerCase()))
                          .map(s => {
                            const count = statusCounts[s] || 0;
                            const isSelected = modalStatusFilter.includes(s);
                            return (
                              <div key={s} 
                                className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-between group transition-colors ${
                                  isSelected ? 'bg-[#003875] text-white' : 'hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 text-gray-700 dark:text-gray-300'
                                }`}
                                onClick={() => setModalStatusFilter(prev => isSelected ? prev.filter(x => x !== s) : [...prev, s])}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'border-gray-300 dark:border-navy-600'}`}>
                                    {isSelected && <CheckIcon className="w-3 h-3 text-[#003875]" />}
                                  </div>
                                  <span>{s}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-gray-100 dark:bg-navy-800 text-gray-500'}`}>
                                  {count}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Priority Filter */}
                <div className="relative">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Priority</label>
                  <div 
                    className="w-full bg-[#FFFBF0] dark:bg-navy-900 border-2 border-orange-50 dark:border-navy-700 rounded-xl px-4 py-2.5 cursor-pointer flex justify-between items-center hover:border-[#003875] dark:hover:border-[#FFD500] transition-colors shadow-sm"
                    onClick={() => {
                        setModalPriorityOpen(!modalPriorityOpen);
                        setModalStatusOpen(false);
                         setModalAssignedToOpen(false);
                         setModalAssignedByOpen(false);
                         setModalDepartmentOpen(false);
                         setModalFrequencyOpen(false);
                    }}
                  >
                    <span className="text-xs font-bold truncate">
                      {modalPriorityFilter.length > 0 ? `${modalPriorityFilter.length} Selected` : "All Priorities"}
                    </span>
                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${modalPriorityOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {modalPriorityOpen && (
                    <div className="absolute z-[10000] w-full mt-2 bg-white dark:bg-navy-900 border-2 border-[#003875] dark:border-[#FFD500] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                       <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                        {['Low', 'Medium', 'High'].map(p => {
                          const count = modalCounts.priority[p] || 0;
                          const isSelected = modalPriorityFilter.includes(p);
                          return (
                            <div key={p} 
                              className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-between group transition-colors ${
                                isSelected ? 'bg-[#003875] text-white' : 'hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 text-gray-700 dark:text-gray-300'
                              }`}
                              onClick={() => setModalPriorityFilter(prev => isSelected ? prev.filter(x => x !== p) : [...prev, p])}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'border-gray-300 dark:border-navy-600'}`}>
                                  {isSelected && <CheckIcon className="w-3 h-3 text-[#003875]" />}
                                </div>
                                <span>{p}</span>
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-gray-100 dark:bg-navy-800 text-gray-500'}`}>
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assigned To Filter */}
                <div className="relative">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Assigned To</label>
                  <div 
                    className="w-full bg-[#FFFBF0] dark:bg-navy-900 border-2 border-orange-50 dark:border-navy-700 rounded-xl px-4 py-2.5 cursor-pointer flex justify-between items-center hover:border-[#003875] dark:hover:border-[#FFD500] transition-colors shadow-sm"
                    onClick={() => {
                        setModalAssignedToOpen(!modalAssignedToOpen);
                        setModalStatusOpen(false);
                        setModalPriorityOpen(false);
                         setModalAssignedByOpen(false);
                         setModalDepartmentOpen(false);
                         setModalFrequencyOpen(false);
                    }}
                  >
                    <span className="text-xs font-bold truncate">
                      {modalAssignedToFilter.length > 0 ? `${modalAssignedToFilter.length} Selected` : "Everyone"}
                    </span>
                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${modalAssignedToOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {modalAssignedToOpen && (
                    <div className="absolute z-[10000] w-full mt-2 bg-white dark:bg-navy-900 border-2 border-[#003875] dark:border-[#FFD500] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                       <div className="p-2 border-b border-orange-50 dark:border-navy-700">
                        <input 
                          type="text" placeholder="Search users..." value={modalAssignedToSearch}
                          onChange={(e) => setModalAssignedToSearch(e.target.value)}
                          className="w-full bg-[#FFFBF0] dark:bg-navy-950 px-3 py-1.5 rounded-lg border-none outline-none text-xs font-bold"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                        {usersList
                          .filter(u => u.username.toLowerCase().includes(modalAssignedToSearch.toLowerCase()))
                          .map(u => {
                            const count = modalCounts.assignedTo[u.username] || 0;
                            const isSelected = modalAssignedToFilter.includes(u.username);
                            return (
                              <div key={`filter-to-${u.username || `id-${u.id}`}`} 
                                className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-between group transition-colors ${
                                  isSelected ? 'bg-[#003875] text-white' : 'hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 text-gray-700 dark:text-gray-300'
                                }`}
                                onClick={() => setModalAssignedToFilter(prev => isSelected ? prev.filter(x => x !== u.username) : [...prev, u.username])}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'border-gray-300 dark:border-navy-600'}`}>
                                    {isSelected && <CheckIcon className="w-3 h-3 text-[#003875]" />}
                                  </div>
                                  <span>{u.username}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-gray-100 dark:bg-navy-800 text-gray-500'}`}>
                                  {count}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assigned By Filter */}
                <div className="relative">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Assigned By</label>
                  <div 
                    className="w-full bg-[#FFFBF0] dark:bg-navy-900 border-2 border-orange-50 dark:border-navy-700 rounded-xl px-4 py-2.5 cursor-pointer flex justify-between items-center hover:border-[#003875] dark:hover:border-[#FFD500] transition-colors shadow-sm"
                    onClick={() => {
                        setModalAssignedByOpen(!modalAssignedByOpen);
                        setModalStatusOpen(false);
                        setModalPriorityOpen(false);
                        setModalAssignedToOpen(false);
                         setModalDepartmentOpen(false);
                         setModalFrequencyOpen(false);
                    }}
                  >
                    <span className="text-xs font-bold truncate">
                      {modalAssignedByFilter.length > 0 ? `${modalAssignedByFilter.length} Selected` : "All Senders"}
                    </span>
                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${modalAssignedByOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {modalAssignedByOpen && (
                    <div className="absolute z-[10000] w-full mt-2 bg-white dark:bg-navy-900 border-2 border-[#003875] dark:border-[#FFD500] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                       <div className="p-2 border-b border-orange-50 dark:border-navy-700">
                        <input 
                          type="text" placeholder="Search users..." value={modalAssignedBySearch}
                          onChange={(e) => setModalAssignedBySearch(e.target.value)}
                          className="w-full bg-[#FFFBF0] dark:bg-navy-950 px-3 py-1.5 rounded-lg border-none outline-none text-xs font-bold"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                        {usersList
                          .filter(u => ['ADMIN', 'EA'].includes(u.role_name?.toUpperCase() || '') && u.username.toLowerCase().includes(modalAssignedBySearch.toLowerCase()))
                          .map(u => {
                            const count = modalCounts.assignedBy[u.username] || 0;
                            const isSelected = modalAssignedByFilter.includes(u.username);
                            return (
                              <div key={`filter-by-${u.username || `id-${u.id}`}`} 
                                className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-between group transition-colors ${
                                  isSelected ? 'bg-[#003875] text-white' : 'hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 text-gray-700 dark:text-gray-300'
                                }`}
                                onClick={() => setModalAssignedByFilter(prev => isSelected ? prev.filter(x => x !== u.username) : [...prev, u.username])}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'border-gray-300 dark:border-navy-600'}`}>
                                    {isSelected && <CheckIcon className="w-3 h-3 text-[#003875]" />}
                                  </div>
                                  <span>{u.username}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-gray-100 dark:bg-navy-800 text-gray-500'}`}>
                                  {count}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Department Filter */}
                <div className="relative">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Department</label>
                  <div 
                    className="w-full bg-[#FFFBF0] dark:bg-navy-900 border-2 border-orange-50 dark:border-navy-700 rounded-xl px-4 py-2.5 cursor-pointer flex justify-between items-center hover:border-[#003875] dark:hover:border-[#FFD500] transition-colors shadow-sm"
                    onClick={() => {
                        setModalDepartmentOpen(!modalDepartmentOpen);
                        setModalStatusOpen(false);
                        setModalPriorityOpen(false);
                        setModalAssignedToOpen(false);
                        setModalAssignedByOpen(false);
                         setModalFrequencyOpen(false);
                    }}
                  >
                    <span className="text-xs font-bold truncate">
                      {modalDepartmentFilter.length > 0 ? `${modalDepartmentFilter.length} Selected` : "All Departments"}
                    </span>
                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${modalDepartmentOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {modalDepartmentOpen && (
                    <div className="absolute z-[10000] w-full mt-2 bg-white dark:bg-navy-900 border-2 border-[#003875] dark:border-[#FFD500] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                       <div className="p-2 border-b border-orange-50 dark:border-navy-700">
                        <input 
                          type="text" placeholder="Search departments..." value={modalDepartmentSearch}
                          onChange={(e) => setModalDepartmentSearch(e.target.value)}
                          className="w-full bg-[#FFFBF0] dark:bg-navy-950 px-3 py-1.5 rounded-lg border-none outline-none text-xs font-bold"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                        {predefinedDepartments
                          .filter(d => d.toLowerCase().includes(modalDepartmentSearch.toLowerCase()))
                          .map(d => {
                            const count = modalCounts.department[d] || 0;
                            const isSelected = modalDepartmentFilter.includes(d);
                            return (
                              <div key={d} 
                                className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-between group transition-colors ${
                                  isSelected ? 'bg-[#003875] text-white' : 'hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 text-gray-700 dark:text-gray-300'
                                }`}
                                onClick={() => setModalDepartmentFilter(prev => isSelected ? prev.filter(x => x !== d) : [...prev, d])}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'border-gray-300 dark:border-navy-600'}`}>
                                    {isSelected && <CheckIcon className="w-3 h-3 text-[#003875]" />}
                                  </div>
                                  <span>{d}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-gray-100 dark:bg-navy-800 text-gray-500'}`}>
                                  {count}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Frequency Filter */}
                <div className="relative">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Frequency</label>
                  <div 
                    className="w-full bg-[#FFFBF0] dark:bg-navy-900 border-2 border-orange-50 dark:border-navy-700 rounded-xl px-4 py-2.5 cursor-pointer flex justify-between items-center hover:border-[#003875] dark:hover:border-[#FFD500] transition-colors shadow-sm"
                    onClick={() => {
                        setModalFrequencyOpen(!modalFrequencyOpen);
                        setModalStatusOpen(false);
                        setModalPriorityOpen(false);
                        setModalAssignedToOpen(false);
                        setModalAssignedByOpen(false);
                        setModalDepartmentOpen(false);
                    }}
                  >
                    <span className="text-xs font-bold truncate">
                      {modalFrequencyFilter.length > 0 ? `${modalFrequencyFilter.length} Selected` : "All Frequencies"}
                    </span>
                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${modalFrequencyOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {modalFrequencyOpen && (
                    <div className="absolute z-[10000] w-full mt-2 bg-white dark:bg-navy-900 border-2 border-[#003875] dark:border-[#FFD500] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                       <div className="p-2 border-b border-orange-50 dark:border-navy-700">
                        <input 
                          type="text" placeholder="Search frequency..." value={modalFrequencySearch}
                          onChange={(e) => setModalFrequencySearch(e.target.value)}
                          className="w-full bg-[#FFFBF0] dark:bg-navy-950 px-3 py-1.5 rounded-lg border-none outline-none text-xs font-bold"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                        {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half Yearly', 'Yearly']
                          .filter(f => f.toLowerCase().includes(modalFrequencySearch.toLowerCase()))
                          .map(f => {
                            const count = modalCounts.frequency[f] || 0;
                            const isSelected = modalFrequencyFilter.includes(f);
                            return (
                              <div key={f} 
                                className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-between group transition-colors ${
                                  isSelected ? 'bg-[#003875] text-white' : 'hover:bg-[#003875]/5 dark:hover:bg-[#FFD500]/10 text-gray-700 dark:text-gray-300'
                                }`}
                                onClick={() => setModalFrequencyFilter(prev => isSelected ? prev.filter(x => x !== f) : [...prev, f])}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'border-gray-300 dark:border-navy-600'}`}>
                                    {isSelected && <CheckIcon className="w-3 h-3 text-[#003875]" />}
                                  </div>
                                  <span>{f}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-gray-100 dark:bg-navy-800 text-gray-500'}`}>
                                  {count}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 dark:bg-navy-900 border-t-4 border-orange-50 dark:border-navy-700 flex gap-3">
              <button 
                onClick={() => {
                  setModalStartDate("");
                  setModalEndDate("");
                  setModalStatusFilter([]);
                  setModalPriorityFilter([]);
                  setModalAssignedToFilter([]);
                  setModalAssignedByFilter([]);
                  setModalDepartmentFilter([]);
                  setModalFrequencyFilter([]);
                }}
                className="flex-1 px-4 py-3 rounded-2xl font-black text-[#CE2029] hover:bg-red-50 dark:hover:bg-red-900/10 transition-all uppercase tracking-widest text-[10px] border-2 border-[#CE2029]/20"
              >
                Clear All
              </button>
              <button 
                onClick={() => setIsFilterModalOpen(false)}
                className="flex-[2] bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black px-4 py-3 rounded-2xl font-black transition-all shadow-lg active:scale-95 uppercase tracking-widest text-[10px] hover:shadow-[#003875]/20 dark:hover:shadow-[#FFD500]/20"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
