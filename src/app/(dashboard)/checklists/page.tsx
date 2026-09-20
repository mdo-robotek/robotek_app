"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Checklist } from "@/types/checklist";
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
import { useSSE } from "@/hooks/useSSE";
import { applyPaginatedIncrementalUpdate } from "@/lib/utils/swr-sync";

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
  const [sortConfig, setSortConfig] = useState<{ key: keyof Checklist; direction: 'asc' | 'desc' } | null>({ key: 'id', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'list' | 'tile'>('list');

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
    verification_required: "No",
    attachment_required: "No",
    frequency: "Daily",
    due_date: "",
    status: "Pending",
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
  const [selectedTask, setSelectedTask] = useState<Checklist | null>(null);
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState("");
  const [remarkText, setRemarkText] = useState("");
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [revisedDueDate, setRevisedDueDate] = useState("");
   const [pendingDeleteGroupId, setPendingDeleteGroupId] = useState<string | null>(null);
 
   const [submitting, setSubmitting] = useState(false);

  // Server-side paginated SWR
  const checklistSWRKey = `/api/checklists?page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(searchTerm)}&statusFilters=${encodeURIComponent(JSON.stringify(activeStatusFilters))}&assignmentFilter=${encodeURIComponent(assignmentFilter)}&currentUser=${encodeURIComponent(currentUser)}&userRole=${encodeURIComponent(userRole)}&dateFilters=${encodeURIComponent(JSON.stringify(dateFilters))}&startDate=${encodeURIComponent(modalStartDate)}&endDate=${encodeURIComponent(modalEndDate)}&modalStatus=${encodeURIComponent(JSON.stringify(modalStatusFilter))}&modalPriority=${encodeURIComponent(JSON.stringify(modalPriorityFilter))}&modalAssignedTo=${encodeURIComponent(JSON.stringify(modalAssignedToFilter))}&modalAssignedBy=${encodeURIComponent(JSON.stringify(modalAssignedByFilter))}&modalDepartment=${encodeURIComponent(JSON.stringify(modalDepartmentFilter))}&modalFrequency=${encodeURIComponent(JSON.stringify(modalFrequencyFilter))}&sortKey=${encodeURIComponent(sortConfig?.key || 'id')}&sortDir=${encodeURIComponent(sortConfig?.direction || 'desc')}`;
  const { data: paginationData, isLoading: isPageLoading, mutate: mutateChecklists } = useSWR<{
    data: Checklist[];
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
    revalidateOnMount: true,
    refreshInterval: 0,
  });
  const isLoading = isPageLoading;

  // SSE: incrementally update local cache when a change is detected
  useSSE({ 
    modules: ['checklists'], 
    onUpdate: (incremental) => {
      const updates = incremental.find(m => m.module === 'checklists');
      if (updates) {
        mutateChecklists((current) => applyPaginatedIncrementalUpdate(current as any, updates.upserts, updates.currentIds), false);
      }
    } 
  });

  // Derived data from server response
  const paginatedChecklists = paginationData?.data || [];
  const totalPages = paginationData?.totalPages || 1;
  const statusCounts = paginationData?.statusCounts || {};
  const dateCounts = paginationData?.dateCounts || {};
  const toMeCount = paginationData?.toMeCount || 0;
  const byMeCount = paginationData?.byMeCount || 0;
  const modalCounts = paginationData?.counts || { priority: {}, assignedTo: {}, assignedBy: {}, department: {}, frequency: {} };

   useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedTask) {
      fetchHistory(selectedTask.id);
    } else {
      setTaskHistory([]);
      setUpdatingStatus("");
      setRemarkText("");
      setRevisionReason("");
      setEvidenceFile(null);
      setRevisedDueDate("");
    }
  }, [selectedTask]);

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

  const handleUpdateStatus = async () => {
    if (!selectedTask || !updatingStatus) return;

    // Validation: Compulsory evidence if required
    if (updatingStatus === 'Completed' && selectedTask.attachment_required === 'Yes' && !evidenceFile) {
      alert("Attachment is required for this checklist item when marking as Completed.");
      return;
    }

    setIsStatusModalOpen(true);
    setActionStatus('loading');
    setActionMessage("Updating status...");
    setIsSubmittingUpdate(true);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("status", updatingStatus);
      formDataToSend.append("reason", revisionReason);
      formDataToSend.append("revised_due_date", revisedDueDate);
      if (evidenceFile) {
        formDataToSend.append("evidence", evidenceFile);
      }

      const res = await fetch(`/api/checklists/${selectedTask.id}/status`, {
        method: "POST",
        body: formDataToSend,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.checklist) {
          mutateChecklists((current) => {
            if (!current?.data) return current;
            return {
              ...current,
              data: current.data.map((c) =>
                String(c.id) === String(data.checklist.id) ? data.checklist : c
              ),
            };
          }, false);
        }
        setUpdatingStatus("");
        setRevisionReason("");
        setEvidenceFile(null);
        setRevisedDueDate("");
        setSelectedTask(data.checklist || null);

        setActionStatus('success');
        setActionMessage("Status updated successfully!");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        const err = await res.json();
        setActionStatus('error');
        setActionMessage(err.error || "Failed to update status");
        setTimeout(() => setIsStatusModalOpen(false), 3000);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      setActionStatus('error');
      setActionMessage("An error occurred while updating status");
      setTimeout(() => setIsStatusModalOpen(false), 3000);
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const handleAddRemark = async () => {
    if (!selectedTask || !remarkText.trim()) return;

    setIsStatusModalOpen(true);
    setActionStatus('loading');
    setActionMessage("Adding remark to sheet...");
    setIsSubmittingUpdate(true);

    try {
      const res = await fetch(`/api/checklists/${selectedTask.id}/remarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remark: remarkText }),
      });

      if (res.ok) {
        setRemarkText("");
        
        setActionStatus('success');
        setActionMessage("Remark added successfully!");
        setTimeout(() => setIsStatusModalOpen(false), 1500);
      } else {
        const err = await res.json();
        setActionStatus('error');
        setActionMessage(err.error || "Failed to add remark");
        setTimeout(() => setIsStatusModalOpen(false), 3000);
      }
    } catch (error) {
      console.error("Error adding remark:", error);
      setActionStatus('error');
      setActionMessage("An error occurred while adding remark");
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
      verification_required: "No",
      attachment_required: "No",
      frequency: "Daily",
      due_date: "",
      status: "Pending",
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
    
    const now = new Date();
    const nowIso = now.toISOString();

    setIsModalOpen(false);
    setActionStatus('loading');
    setActionMessage(editingItem ? "Updating Task..." : "Creating Tasks...");
    setIsStatusModalOpen(true);

    try {
      if (editingItem) {
        const url = formData.group_id 
          ? `/api/checklists/${editingItem.id}?groupId=${formData.group_id}`
          : `/api/checklists/${editingItem.id}`;
        
        let finalDueDate = formData.due_date || "";
        if (finalDueDate && /^\d{4}-\d{2}-\d{2}$/.test(finalDueDate)) {
          const d = new Date(finalDueDate);
          d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
          finalDueDate = d.toISOString();
        }

        const payload = {
          ...formData,
          due_date: finalDueDate,
          frequency: formData.frequency?.startsWith('Weekly') ? 'Weekly' : formData.frequency,
          updated_at: nowIso,
        } as Checklist;

        const res = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to update checklist");
        }
      } else {
        const selectedDates = formData.due_date?.split(',').map(d => d.trim()).filter(Boolean) || [];
        const datesToSubmit = selectedDates.length > 0 ? selectedDates : [""];
        const sharedGroupId = `GR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        const payloadArray = datesToSubmit.map((dateStr) => {
          let finalDueDate = dateStr;
          if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const d = new Date(dateStr);
            d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
            finalDueDate = d.toISOString();
          }

          return {
            ...formData,
            id: "", 
            group_id: sharedGroupId,
            due_date: finalDueDate,
            frequency: formData.frequency?.startsWith('Weekly') ? 'Weekly' : formData.frequency,
            created_at: nowIso,
            updated_at: nowIso,
          };
        });

        const res = await fetch("/api/checklists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadArray),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to create checklist`);
        }
      }

      resetForm();
      await mutateChecklists(); // Final wait for sync
      setActionStatus('success');
      setActionMessage(editingItem ? "Task updated successfully!" : "Tasks created successfully!");
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

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const dates = dateStr.split(',').map(d => d.trim()).filter(Boolean);
    
    const formattedDates = dates.map(d => {
      // Handle ISO strings
      if (d.includes('T')) {
        const date = new Date(d);
        return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }

      // Handle YYYY-MM-DD
      if (d.includes('-') && d.split('-').length === 3) {
        const [y, m, day] = d.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
          return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
      }
      
      const date = new Date(d);
      return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    });

    return formattedDates.join(', ');
  };

  const handleExport = async () => {
    const exportUrl = checklistSWRKey
      .replace(`page=${currentPage}`, 'page=1')
      .replace(`limit=${itemsPerPage}`, 'limit=100000');
    try {
      const res = await fetch(exportUrl);
      const result = await res.json();
      const allItems: Checklist[] = result.data || [];

      const headers = ["ID", "Task", "Assigned By", "Assigned To", "Priority", "Department", "Verification", "Attachment", "Frequency", "Due Date", "Status", "Group ID"];
      const rows = allItems.map((c: Checklist) => [
        c.id, c.task, c.assigned_by, c.assigned_to, c.priority, c.department,
        c.verification_required, c.attachment_required,
        c.frequency, c.due_date, c.status, c.group_id
      ]);

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
    setPendingDeleteGroupId(item.group_id);
    setIsConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!pendingDeleteId) return;

    setIsConfirmOpen(false);
    setActionStatus('loading');
    setActionMessage(pendingDeleteGroupId ? "Deleting Group..." : "Deleting Task...");
    setIsStatusModalOpen(true);

    try {
      const url = pendingDeleteGroupId 
        ? `/api/checklists/${pendingDeleteId}?groupId=${pendingDeleteGroupId}`
        : `/api/checklists/${pendingDeleteId}`;

      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      
      await mutateChecklists(); // Wait for sync
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
      setPendingDeleteGroupId(null);
    }
  };

  // Filtering and sorting handled server-side. Client only needs display status for badges.
  const getDisplayStatus = (item: Checklist) => {
    const s = item.status;
    if (s && s !== 'Pending') return s;
    if (!item.due_date) return s || 'Pending';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = getEarliestDate(item.due_date);
    if (!due) return item.status || 'Pending';
    due.setHours(0, 0, 0, 0);
    if (due < now) return 'Overdue';
    if (due > now) return 'Planned';
    return 'Pending';
  };

  const handleSort = (key: keyof Checklist) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: keyof Checklist }) => {
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
    } else if (s === 'overdue') {
      color = "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
      Icon = ExclamationTriangleIcon;
    } else if (s === 'planned') {
      color = "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
      Icon = CalendarDaysIcon;
    }
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md border ${color}`}>
        <Icon className="w-3 h-3" />
        {status || "Pending"}
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

  const renderUserAvatar = (username: string) => {
    if (!username || username === "—") return <span className="font-bold text-gray-500 dark:text-gray-400">—</span>;
    const user = usersList.find((u) => u.username === username);
    if (user?.image_url) {
      return (
        <div className="flex items-center gap-2">
          <img src={user.image_url} alt={username} className="w-6 h-6 rounded-full object-cover border border-gray-200 dark:border-white/10 shadow-sm" />
          <span className="font-bold text-gray-900 dark:text-white text-[11px] truncate">{username}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full shrink-0 bg-gradient-to-br from-[#003875] to-[#002855] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
          {username.charAt(0).toUpperCase()}
        </div>
        <span className="font-bold text-gray-900 dark:text-white text-[11px] truncate">{username}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sticky Top Header & Filters */}
      <div className="sticky top-0 z-10 bg-[var(--panel-bg)] -mx-2 -mt-2 p-2 pt-0.5 md:-mx-4 md:-mt-4 md:p-4 md:pt-1 border-b border-gray-100 dark:border-white/5 shadow-sm space-y-4">
        {/* Responsive Title Row */}
      <div className="flex flex-col lg:flex-row items-center gap-4 px-1">
        <div className="w-full lg:w-1/3 text-center lg:text-left min-w-0">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">Checklists</h1>
          <p className="text-gray-500 dark:text-slate-300 font-bold text-[8px] md:text-[10px] uppercase tracking-wider">Task Verification System</p>
        </div>
        
        <div className="w-full lg:w-1/3 flex justify-center flex-shrink-0 min-w-0">
          <div className="flex items-center gap-1.5 rounded-full border-2 border-b-4 border-[#003875] dark:border-[#FFD500] bg-white dark:bg-navy-800 shadow-sm transition-all active:translate-y-[2px] active:border-b-2 p-1 max-w-full">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-50 dark:bg-navy-900 rounded-full p-0.5 border border-gray-100 dark:border-navy-700">
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

          <div className="h-4 w-[1px] bg-gray-100 dark:bg-white/10" />

          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 text-[#003875] dark:text-[#FFD500] px-3 md:px-5 py-2 font-black transition-colors hover:bg-gray-100 dark:hover:bg-navy-700 uppercase tracking-widest text-[9px] md:text-[10px] rounded-full whitespace-nowrap"
            title="Export to CSV"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <div className="h-4 w-[1px] bg-gray-100 dark:bg-white/10" />

          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="flex items-center justify-center gap-2 text-[#003875] dark:text-[#FFD500] px-3 md:px-5 py-2 font-black transition-colors hover:bg-gray-100 dark:hover:bg-navy-700 uppercase tracking-widest text-[9px] md:text-[10px] rounded-full whitespace-nowrap relative"
            title="Advanced Filters"
          >
            <FunnelIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Filter</span>
            {(modalStartDate || modalEndDate || modalStatusFilter.length > 0 || modalPriorityFilter.length > 0 || modalAssignedToFilter.length > 0 || modalAssignedByFilter.length > 0 || modalDepartmentFilter.length > 0 || modalFrequencyFilter.length > 0) && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-navy-800 animate-pulse" />
            )}
          </button>

          <div className="h-4 w-[1px] bg-gray-100 dark:bg-white/10" />

          <button
            onClick={() => {
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-navy-700 text-[#003875] dark:text-[#FFD500] px-3 py-2 transition-colors rounded-full"
            title="New Checklist"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
        </div>
        <div className="hidden lg:block lg:w-1/3"></div>
      </div>

      <div 
        style={{ borderColor: 'var(--panel-border)' }}
        className="rounded-2xl border overflow-hidden shadow-sm transition-all duration-500"
      >
        {/* Status Filtration Tiles - Single row scrollable on mobile */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 p-3 bg-gray-50/50 dark:bg-navy-900/30 border-b border-gray-100 dark:border-navy-700/50">
          {[
            { label: 'All', icon: <TagIcon className="w-3 h-3" />, color: 'bg-white text-gray-700 border-gray-300 dark:bg-navy-800 dark:text-gray-300 dark:border-navy-600' },
            { label: 'Pending', icon: <ClockIcon className="w-3 h-3" />, color: 'bg-gray-50 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600' },
            { label: 'Planned', icon: <CalendarDaysIcon className="w-3 h-3" />, color: 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' },
            { label: 'Completed', icon: <CheckCircleIcon className="w-3 h-3" />, color: 'bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' },
            { label: 'Approved', icon: <ShieldCheckIcon className="w-3 h-3" />, color: 'bg-green-50 text-green-600 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
            { label: 'Overdue', icon: <ExclamationTriangleIcon className="w-3 h-3" />, color: 'bg-red-50 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
          ].map(tile => {
            const count = statusCounts[tile.label] || 0;
            const isActive = tile.label === 'All' ? activeStatusFilters.length === 0 : activeStatusFilters.includes(tile.label);
            return (
              <button
                key={tile.label}
                onClick={() => {
                  if (tile.label === 'All') {
                    setActiveStatusFilters([]);
                    setDateFilters([]);
                    setAssignmentFilter('All');
                    setSearchTerm('');
                    // Reset modal filters
                    setModalStartDate("");
                    setModalEndDate("");
                    setModalStatusFilter([]);
                    setModalPriorityFilter([]);
                    setModalAssignedToFilter([]);
                    setModalAssignedByFilter([]);
                    setModalDepartmentFilter([]);
                    setModalFrequencyFilter([]);
                  } else {
                    const newFilters = activeStatusFilters.includes(tile.label)
                      ? activeStatusFilters.filter(f => f !== tile.label)
                      : [...activeStatusFilters, tile.label];
                    setActiveStatusFilters(newFilters);
                  }
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                  isActive 
                    ? 'bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black border-[#003875] dark:border-[#FFD500] shadow-md scale-105' 
                    : `${tile.color} hover:scale-[1.02] hover:shadow-sm`
                }`}
              >
                {tile.icon}
                {tile.label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${
                  isActive ? 'bg-white/20 dark:bg-black/20' : 'bg-black/5 dark:bg-white/10'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Controls Bar */}
        {/* Controls Bar */}
        <div 
          style={{ backgroundColor: 'var(--panel-card)', borderBottom: '1px solid var(--panel-border)' }}
          className="p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
        >
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 flex-1 w-full min-w-0">
            {/* Search + Assignment Filters */}
            <div className="flex flex-row items-center gap-2 w-full lg:w-auto lg:flex-1 lg:max-w-md">
              <div className="relative group flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-[#FFD500] transition-colors" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-navy-900 border border-gray-100 dark:border-navy-700/50 rounded-lg focus:border-[#FFD500] outline-none font-bold text-[12px] text-gray-700 dark:text-white transition-all shadow-sm"
                />
              </div>

              {userRole !== 'USER' && (
                <div className="flex items-center bg-gray-100 dark:bg-navy-900 rounded-full p-1 border border-gray-200 dark:border-navy-700 flex-shrink-0">
                  <button 
                    onClick={() => { setAssignmentFilter(assignmentFilter === 'ToMe' ? 'All' : 'ToMe'); setCurrentPage(1); }}
                    className={`px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all h-[26px] flex items-center gap-1 ${assignmentFilter === 'ToMe' ? 'bg-[#003875] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                  >
                    <span className="hidden xs:inline">To Me</span>
                    <span className="xs:hidden">To</span>
                    <span className={`px-1 rounded-full text-[8px] ${assignmentFilter === 'ToMe' ? 'bg-white/20' : 'bg-gray-200 dark:bg-navy-800'}`}>
                      {toMeCount}
                    </span>
                  </button>
                  <button 
                    onClick={() => { setAssignmentFilter(assignmentFilter === 'ByMe' ? 'All' : 'ByMe'); setCurrentPage(1); }}
                    className={`px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all h-[26px] flex items-center gap-1 ${assignmentFilter === 'ByMe' ? 'bg-[#003875] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                  >
                    <span className="hidden xs:inline">By Me</span>
                    <span className="xs:hidden">By</span>
                    <span className={`px-1 rounded-full text-[8px] ${assignmentFilter === 'ByMe' ? 'bg-white/20' : 'bg-gray-200 dark:bg-navy-800'}`}>
                      {byMeCount}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'Delayed', label: 'Delayed', color: 'bg-red-50 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
                { id: 'Today', label: 'Today', color: 'bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' },
                { id: 'Tomorrow', label: 'Tomorrow', color: 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' },
                { id: 'Next3', label: 'Next 3', color: 'bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' }
              ].map(f => {
                const count = dateCounts[f.id] || 0;
                const isActive = dateFilters.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      const newFilters = dateFilters.includes(f.id)
                        ? dateFilters.filter(item => item !== f.id)
                        : [...dateFilters, f.id];
                      setDateFilters(newFilters);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 rounded-full border text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all h-[28px] flex items-center gap-1.5 whitespace-nowrap ${
                      isActive 
                        ? 'bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black border-[#003875] dark:border-[#FFD500] shadow-sm scale-105' 
                        : `${f.color} hover:shadow-sm hover:scale-[1.02]`
                    }`}
                  >
                    {f.label}
                    <span className={`px-1 py-0.5 rounded-full text-[8px] ${isActive ? 'bg-white/20 dark:bg-black/20' : 'bg-black/5 dark:bg-white/10'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pagination Info */}
          <div className="flex items-center justify-between sm:justify-end gap-3 md:gap-4 flex-shrink-0 border-t lg:border-t-0 border-gray-100 dark:border-white/5 pt-3 lg:pt-0">
            <div className="flex items-center gap-2">
              <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                Page <span className="text-[#003875] dark:text-[#FFD500]">{currentPage}</span> of {totalPages || 1}
              </p>
              <div className="flex gap-0.5">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-1.5 py-1 text-[9px] md:text-[10px] font-bold text-gray-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all">First</button>
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 text-gray-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all">
                  <ChevronLeftIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1 text-gray-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all">
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="px-1.5 py-1 text-[9px] md:text-[10px] font-bold text-gray-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all">Last</button>
              </div>
            </div>
            <div className="hidden xs:block h-4 w-[1px] bg-gray-200 dark:bg-white/10" />
            <div className="flex items-center gap-2">
              <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Show</label>
              <select 
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-transparent border-none p-0 text-[10px] font-bold outline-none dark:text-white cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

        {viewMode === 'list' ? (
          /* Table View - Scrollable on mobile */
          <div 
            style={{ backgroundColor: 'var(--panel-card)' }}
            className="overflow-x-auto no-scrollbar transition-colors duration-500 min-h-[400px] w-full"
          >
            <table className="w-full text-left border-collapse table-auto min-w-[800px]">
            <thead>
              <tr className="bg-[#003875] dark:bg-navy-950 text-white dark:text-slate-200 whitespace-nowrap">
                <th onClick={() => handleSort('id')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="flex items-center">ID <SortIcon column="id" /></div>
                </th>
                <th onClick={() => handleSort('task')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors min-w-[200px]">
                  <div className="flex items-center">Task <SortIcon column="task" /></div>
                </th>
                <th onClick={() => handleSort('assigned_to')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden sm:table-cell min-w-[140px]">
                  <div className="flex items-center">Assigned To <SortIcon column="assigned_to" /></div>
                </th>
                <th onClick={() => handleSort('assigned_by')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden sm:table-cell min-w-[140px]">
                  <div className="flex items-center">Assigned By <SortIcon column="assigned_by" /></div>
                </th>
                <th onClick={() => handleSort('department')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden md:table-cell">
                  <div className="flex items-center">Dept <SortIcon column="department" /></div>
                </th>
                <th onClick={() => handleSort('priority')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden sm:table-cell">
                  <div className="flex items-center">Priority <SortIcon column="priority" /></div>
                </th>
                <th onClick={() => handleSort('status')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="flex items-center">Status <SortIcon column="status" /></div>
                </th>
                <th onClick={() => handleSort('frequency')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden xl:table-cell">
                  <div className="flex items-center">Freq <SortIcon column="frequency" /></div>
                </th>
                <th onClick={() => handleSort('due_date')} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="flex items-center">Due <SortIcon column="due_date" /></div>
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <div className="w-6 h-6 border-2 border-gray-100 border-t-[#FFD500] rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[8px]">Syncing...</p>
                  </td>
                </tr>
              ) : paginatedChecklists.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No checklists found</p>
                  </td>
                </tr>
              ) : (
                paginatedChecklists.map((item) => (
                  <tr key={item.id} className="hover:bg-orange-50/10 border-b-2 border-gray-200 dark:border-white/10 last:border-0 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] text-gray-400 font-bold">#{item.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-black text-xs text-gray-900 dark:text-white leading-tight">{item.task}</p>
                      {item.verification_required?.toLowerCase() === 'yes' && (
                        <p className="text-[9px] text-amber-500 font-bold mt-0.5">🔍 Verification Required</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {renderUserAvatar(item.assigned_to)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {renderUserAvatar(item.assigned_by)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {getDeptBadge(item.department)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">{getPriorityBadge(item.priority)}</td>
                    <td className="px-4 py-3">{getStatusBadge(getDisplayStatus(item))}</td>
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
                    <td className="px-4 py-3">
                      <p className="text-[10px] md:text-xs font-bold text-gray-600 dark:text-slate-300">{formatDateDisplay(item.due_date) || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedTask(item)}
                          className="p-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-black rounded-lg transition-all"
                          title="Follow Up"
                        >
                          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                        </button>
                        {(['ADMIN', 'EA'].includes(userRole?.toUpperCase()) || item.assigned_by === currentUser) && (
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
                  </tr>
                ))
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
              {paginatedChecklists.map((item) => {
                const status = getDisplayStatus(item);
                const statusColorMap: Record<string, string> = {
                  "Pending": "border-gray-200 dark:border-gray-700",
                  "Planned": "border-blue-200 dark:border-blue-900/50",
                  "Hold": "border-amber-200 dark:border-amber-900/50",
                  "Completed": "border-emerald-200 dark:border-emerald-900/50",
                  "Approved": "border-green-200 dark:border-green-900/50",
                  "Re-Open": "border-violet-200 dark:border-violet-900/50",
                  "Overdue": "border-red-200 dark:border-red-900/50",
                };
                const borderColor = statusColorMap[status] || "border-gray-100 dark:border-white/5";

                return (
                  <div 
                    key={item.id}
                    className={`group bg-white dark:bg-navy-900 rounded-2xl border-4 ${borderColor} shadow-sm hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300 overflow-hidden flex flex-col h-full`}
                  >
                    {/* Card Header */}
                    <div className="p-3 md:p-4 border-b border-gray-50 dark:border-white/5 flex items-start justify-between gap-3 bg-gray-50/30 dark:bg-white/5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[9px] font-black text-[#003875] dark:text-[#FFD500] bg-[#003875]/5 dark:bg-[#FFD500]/10 px-1.5 py-0.5 rounded">#{item.id}</span>
                          {getPriorityBadge(item.priority)}
                        </div>
                        <h3 className="font-black text-sm text-gray-900 dark:text-white leading-tight line-clamp-3 uppercase tracking-wide group-hover:text-[#003875] dark:group-hover:text-[#FFD500] transition-colors">{item.task}</h3>
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(status)}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-3 md:p-4 flex-1 flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3 mt-auto">
                        <div className="flex flex-col gap-1.5 overflow-hidden">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Assigned To</span>
                          {renderUserAvatar(item.assigned_to)}
                        </div>
                        <div className="flex flex-col gap-1 overflow-hidden">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Dept</span>
                          <div className="scale-75 origin-left">
                            {getDeptBadge(item.department)}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 overflow-hidden">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Due Date</span>
                          <span className="text-[10px] font-black text-gray-700 dark:text-slate-300 truncate">{formatDateDisplay(item.due_date) || "—"}</span>
                        </div>
                        <div className="flex flex-col gap-1.5 overflow-hidden">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Assigned By</span>
                          {renderUserAvatar(item.assigned_by)}
                        </div>
                      </div>

                      {item.verification_required?.toLowerCase() === 'yes' && (
                        <div className="flex items-center gap-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg">
                          <MagnifyingGlassIcon className="w-3 h-3 text-amber-500" />
                          <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Verification Req.</span>
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Actions */}
                    <div className="p-2 md:p-3 bg-gray-50/50 dark:bg-white/5 border-t border-gray-50 dark:border-white/5 flex items-center justify-between gap-2">
                       <button
                          onClick={() => setSelectedTask(item)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-black rounded-xl transition-all font-black text-[9px] uppercase tracking-widest whitespace-nowrap overflow-hidden"
                        >
                          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">Follow Up</span>
                        </button>
                        {(['ADMIN', 'EA'].includes(userRole?.toUpperCase()) || item.assigned_by === currentUser) && (
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
                          <div key={`by-${u.id}`}
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
                          <div key={`to-${u.id}`}
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

              {!editingItem && (
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
                                
                                // Auto-calculate next occurrence for ALL selected days from today
                                const nextDates = newDays.map(d => getNextOccurringDay(d));
                                const nextDateStr = nextDates.join(',');
                                
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

              {/* Row 4: Due Date + Verification + Attachment */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-orange-50 dark:border-zinc-800/50 pt-4 items-end">
                {!editingItem ? (
                  <div>
                    <PremiumDatePicker 
                      label="Due Date"
                      value={formData.due_date || ""}
                      onChange={(val) => setFormData({ ...formData, due_date: val })}
                      multiSelect={formData.frequency?.startsWith('Weekly') || ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'].includes(formData.frequency || "")}
                      allowPast={false}
                      allowSundays={false}
                    />
                  </div>
                ) : (
                  <div /> // Spacer to keep verification and attachment in correct columns
                )}

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Verification Required?</label>
                  <div className="flex bg-gray-100 dark:bg-zinc-900/50 p-1 rounded-xl">
                    {(['No', 'Yes'] as const).map((val) => (
                      <button key={val} type="button"
                        onClick={() => setFormData({ ...formData, verification_required: val })}
                        className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          formData.verification_required === val
                            ? val === 'Yes' ? 'bg-emerald-500 text-white shadow-md' : 'bg-gray-400 text-white shadow-md'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >{val === 'Yes' ? '✓ Yes' : '✗ No'}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Attachment Required?</label>
                  <div className="flex bg-gray-100 dark:bg-zinc-900/50 p-1 rounded-xl">
                    {(['No', 'Yes'] as const).map((val) => (
                      <button key={val} type="button"
                        onClick={() => setFormData({ ...formData, attachment_required: val })}
                        className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          formData.attachment_required === val
                            ? val === 'Yes' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-400 text-white shadow-md'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >{val === 'Yes' ? '✓ Yes' : '✗ No'}</button>
                    ))}
                  </div>
                </div>
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

                {/* Status Update & Remarks Section */}
                <div className="space-y-6 border-t border-gray-100 dark:border-white/5 pt-6 pb-2">
                  <div className="w-full">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1">
                      <BoltIcon className="w-4 h-4 text-amber-500" /> Quick Status Update
                    </h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { label: 'Completed', icon: <CheckCircleIcon className="w-3 h-3" />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30' },
                        { label: 'Approved', icon: <ShieldCheckIcon className="w-3 h-3" />, color: 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30', requiresPrivilege: true },
                      ]
                      .filter(item => {
                        if (!item.requiresPrivilege) return true;
                        const isAssigner = selectedTask?.assigned_by === ((session?.user as any)?.username || "");
                        return userRole === 'ADMIN' || isAssigner;
                      })
                      .map((item) => (
                        <button
                          key={item.label}
                          onClick={() => setUpdatingStatus(item.label === updatingStatus ? "" : item.label)}
                          className={`flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-tight border transition-all ${
                            updatingStatus === item.label
                              ? 'bg-[#CE2029] text-white border-[#CE2029] shadow-lg shadow-red-500/30 scale-[1.02]'
                              : `${item.color} hover:scale-[1.02]`
                          }`}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Conditional: Evidence Upload */}
                  {updatingStatus === 'Completed' && selectedTask.attachment_required === 'Yes' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1.5 block">Upload Evidence (Required)</label>
                      <div className="relative group/file">
                        <input
                          type="file"
                          onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="evidence-upload"
                        />
                        <label
                          htmlFor="evidence-upload"
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-red-50/30 dark:bg-red-900/10 border border-dashed border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-50 transition-colors"
                        >
                          <span className="truncate">{evidenceFile?.name || "Select performance proof..."}</span>
                          <PaperClipIcon className="w-4 h-4" />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Optional Reason for status change */}
                  {updatingStatus && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1.5 block">Reason for Status Change</label>
                      <textarea
                        value={revisionReason}
                        onChange={(e) => setRevisionReason(e.target.value)}
                        placeholder="Explain why this status change is happening..."
                        className="w-full px-4 py-2 bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl text-xs dark:text-white outline-none focus:ring-2 focus:ring-red-500/50 min-h-[80px] resize-none"
                      />
                    </div>
                  )}

                  {/* Remarks Input - Only show if NO status is being updated */}
                  {!updatingStatus && (
                    <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <h4 className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <DocumentTextIcon className="w-4 h-4" /> New Remark
                      </h4>
                      <textarea
                        value={remarkText}
                        onChange={(e) => setRemarkText(e.target.value)}
                        placeholder="Type a internal contextual remark..."
                        className="w-full px-4 py-2 bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl text-xs dark:text-white outline-none focus:ring-2 focus:ring-red-500/50 min-h-[80px] resize-none"
                      />
                    </div>
                  )}
                </div>

                {/* History Timeline Tracking */}
                <div className="pt-8 border-t border-gray-100 dark:border-white/5 pb-10 w-full">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 px-1">
                    <ClockIcon className="w-4 h-4 text-blue-500" /> Activity History
                  </h4>
                  
                  {isLoadingHistory ? (
                    <div className="flex flex-col items-center justify-center py-8 opacity-40">
                      <ArrowPathIcon className="w-6 h-6 animate-spin mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Fetching history...</p>
                    </div>
                  ) : taskHistory.length > 0 ? (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100 dark:before:bg-white/5">
                      {taskHistory.map((item, index) => (
                        <div key={item.id} className="relative">
                          <div className={`absolute -left-[30px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-navy-900 z-10 ${
                            item.type === 'remark' ? 'bg-blue-500' : 'bg-amber-500'
                          }`}></div>
                          
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                {item.type === 'remark' ? item.username : `Status -> ${item.new_status}`}
                              </span>
                              <span className="text-[8px] font-bold text-gray-400">{formatDateDisplay(item.created_at)}</span>
                            </div>
                            
                            {item.type === 'remark' ? (
                              <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed font-medium bg-blue-50/30 dark:bg-blue-900/5 p-3 rounded-xl border border-blue-100/30 dark:border-blue-900/20 italic">
                                "{item.remark}"
                              </p>
                            ) : (
                              <div className="text-[10px] text-gray-500 dark:text-slate-500 bg-amber-50/30 dark:bg-amber-900/5 p-3 rounded-xl border border-amber-100/30 dark:border-amber-900/20">
                                {item.reason && <p className="font-bold text-gray-700 dark:text-slate-300 mb-1">Reason: {item.reason}</p>}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 opacity-80">
                                  <span>From: <b className="text-[#CE2029]">{item.old_status}</b></span>
                                </div>
                                {item.evidence_urls && (
                                  <a 
                                    href={`https://drive.google.com/file/d/${item.evidence_urls}/view`} 
                                    target="_blank" 
                                    className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-black text-amber-600 uppercase tracking-widest hover:underline"
                                  >
                                    <PaperClipIcon className="w-3 h-3" /> View Evidence Attachment
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 opacity-30 select-none">
                      <SparklesIconOutline className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No history yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Footer Actions */}
              <div className="p-5 px-6 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-navy-900 flex gap-4 mt-auto sticky bottom-0 z-30 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
                <button
                  onClick={handleUpdateStatus}
                  disabled={
                    !updatingStatus || 
                    isSubmittingUpdate || 
                    (updatingStatus === 'Completed' && selectedTask.attachment_required === 'Yes' && !evidenceFile)
                  }
                  className="w-[70%] px-4 py-3.5 bg-[#CE2029] hover:bg-red-700 disabled:bg-gray-300 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 no-underline border-none"
                  style={{ backgroundColor: !updatingStatus || isSubmittingUpdate || (updatingStatus === 'Completed' && selectedTask.attachment_required === 'Yes' && !evidenceFile) ? '#ccc' : '#CE2029' }}
                >
                  {isSubmittingUpdate && updatingStatus ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="w-5 h-5" />
                  )}
                  Update Status
                </button>
                <button
                  onClick={handleAddRemark}
                  disabled={!remarkText.trim() || isSubmittingUpdate}
                  className="w-[30%] px-4 py-3.5 bg-[#FFD500] hover:bg-yellow-500 disabled:bg-gray-300 text-navy-900 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 no-underline border-none"
                  style={{ backgroundColor: '#FFD500' }}
                >
                  {isSubmittingUpdate && remarkText.trim() ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <DocumentTextIcon className="w-5 h-5" />
                  )}
                  Remark
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
                        {['Pending', 'Planned', 'Need Clarity', 'Need Revision', 'Completed', 'Approved', 'Hold', 'Re-Open', 'Overdue']
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
                              <div key={u.id} 
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
                              <div key={u.id} 
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
