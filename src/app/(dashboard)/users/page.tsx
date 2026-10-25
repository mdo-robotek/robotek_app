"use client";

import { useState, useEffect } from "react";
import { User } from "@/types/user";
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
  UsersIcon,
  EyeIcon,
  MapPinIcon,
  GlobeAmericasIcon,
  CheckIcon
} from "@heroicons/react/24/outline";
import PremiumDatePicker from "@/components/PremiumDatePicker";
import ActionStatusModal from "@/components/ActionStatusModal";
import ConfirmModal from "@/components/ConfirmModal";

import { navigation } from "@/lib/navigation";

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'visibility'>('list');
  const [users, setUsers] = useState<User[]>([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: 'asc' | 'desc' } | null>({ key: 'id', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<User>>({
    id: "",
    username: "",
    email: "",
    password: "",
    phone: "",
    role_name: "",
    late_long: "",
    image_url: "",
    dob: "",
    anniversary_date: "",
    doj: "",
    office: "",
    designation: "",
    department: "",
    locations: [{ name: "Main", coords: "" }],
    isActive: true
  });

  const [dropdowns, setDropdowns] = useState<{ departments: string[], designations: string[] }>({
    departments: [],
    designations: []
  });

  const [isAddingOption, setIsAddingOption] = useState<{ type: 'department' | 'designation', isOpen: boolean }>({
    type: 'department',
    isOpen: false
  });
  const [newOptionValue, setNewOptionValue] = useState("");

  // Action Status States
  const [actionStatus, setActionStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [actionMessage, setActionMessage] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Confirmation states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const res = await fetch("/api/users/dropdowns");
      const data = await res.json();
      setDropdowns(data);
    } catch (error) {
      console.error("Failed to fetch dropdowns:", error);
    }
  };

  const handleAddDropdownOption = async () => {
    if (!newOptionValue.trim()) return;
    
    setActionStatus('loading');
    setActionMessage(`Adding new ${isAddingOption.type}...`);
    setIsStatusModalOpen(true);

    try {
      const res = await fetch("/api/users/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: isAddingOption.type, value: newOptionValue.trim() }),
      });

      if (res.ok) {
        await fetchDropdowns();
        setFormData(prev => ({
          ...prev,
          [isAddingOption.type]: newOptionValue.trim()
        }));
        setIsAddingOption({ ...isAddingOption, isOpen: false });
        setNewOptionValue("");
        setIsStatusModalOpen(false);
      } else {
        throw new Error("Failed to add option");
      }
    } catch (error) {
      setIsStatusModalOpen(false);
      alert("Failed to add new option. Please try again.");
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
        setError(null);
      } else if (data.error) {
        setError(data.error);
        setUsers([]);
      }
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      setError("Failed to connect to AWS Users database");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate next unique employee code (RE###) from existing users
  const nextEmpCode = () => {
    let max = 0;
    users.forEach(u => {
      const m = String(u.id || "").trim().match(/^RE\s*0*(\d+)$/i);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return "RE" + String(max + 1).padStart(3, "0");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicate Employee Code
    const duplicateUser = users.find(u => u.id === formData.id && u.id !== editingUser?.id);
    if (duplicateUser) {
      alert(`The Employee Code "${formData.id}" is already used by ${duplicateUser.username}. Please use a unique code.`);
      return;
    }
    
    
    // Show loading
    setActionStatus('loading');
    setActionMessage(editingUser ? "Updating user profile..." : "Creating new user...");
    setIsStatusModalOpen(true);

    const method = editingUser ? "PUT" : "POST";
    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";

    // Prepare payload by stringifying locations into late_long
    const finalFormData = {
      ...formData,
      late_long: JSON.stringify(formData.locations || [])
    };

    const payload = new FormData();
    payload.append("userData", JSON.stringify(finalFormData));
    if (selectedImage) {
      payload.append("image", selectedImage);
    }

    try {
      const res = await fetch(url, {
        method,
        body: payload,
      });

      if (res.ok) {
        setIsStatusModalOpen(false); // Close loader immediately
        
        setIsModalOpen(false);
        setEditingUser(null);
        setSelectedImage(null);
        setImagePreview(null);
        setFormData({
          id: "",
          username: "",
          email: "",
          password: "",
          phone: "",
          role_name: "",
          late_long: "",
          image_url: "",
          dob: "",
          anniversary_date: "",
          doj: "",
          office: "",
          designation: "",
          department: "",
          locations: [{ name: "Main", coords: "" }],
          isActive: true
        });
        fetchUsers();
      } else {
        throw new Error("Failed to save user");
      }
    } catch (error) {
      setIsStatusModalOpen(false); // Close loader on error too
      alert("Something went wrong while saving. Please try again.");
    }
  };

  const handleFetchLocation = (index: number) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    // Show loading info
    setActionStatus('loading');
    setActionMessage("Fetching your current coordinates...");
    setIsStatusModalOpen(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newCoords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        
        const newLocations = [...(formData.locations || [])];
        newLocations[index] = { ...newLocations[index], coords: newCoords };
        
        setFormData(prev => ({
          ...prev,
          locations: newLocations
        }));
        setIsStatusModalOpen(false);
      },
      (error) => {
        setIsStatusModalOpen(false);
        console.error("Error fetching location:", error);
        let errorMessage = "Failed to fetch location.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access denied. Please enable it in your browser settings.";
        }
        alert(errorMessage);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleViewOnMap = (coords: string) => {
    if (coords) {
      window.open(`https://www.google.com/maps?q=${encodeURIComponent(coords)}`, "_blank");
    } else {
      alert("Please enter or fetch coordinates first.");
    }
  };

  const addLocation = () => {
    setFormData(prev => ({
      ...prev,
      locations: [...(prev.locations || []), { name: "", coords: "" }]
    }));
  };

  const removeLocation = (index: number) => {
    const locations = [...(formData.locations || [])];
    if (locations.length <= 1) {
      alert("At least one location is required.");
      return;
    }
    locations.splice(index, 1);
    setFormData({ ...formData, locations });
  };

  const updateLocation = (index: number, field: 'name' | 'coords', value: string) => {
    const locations = [...(formData.locations || [])];
    locations[index] = { ...locations[index], [field]: value };
    setFormData({ ...formData, locations });
  };

  const handleEdit = (user: User) => {
    let parsedLocations = [{ name: "Main", coords: "" }];
    try {
      if (user.late_long && (user.late_long.startsWith('[') || user.late_long.startsWith('{'))) {
        parsedLocations = JSON.parse(user.late_long);
      } else if (user.late_long) {
        // Legacy single string format
        parsedLocations = [{ name: "Default", coords: user.late_long }];
      }
    } catch (e) {
      console.error("Failed to parse locations:", e);
      parsedLocations = [{ name: "Default", coords: user.late_long || "" }];
    }

    setEditingUser(user);
    setFormData({
      ...user,
      locations: parsedLocations,
      dob: formatDatePickerValue(user.dob || ""),
      anniversary_date: formatDatePickerValue(user.anniversary_date || ""),
      doj: formatDatePickerValue(user.doj || "")
    });
    setImagePreview(user.image_url || null);
    setIsModalOpen(true);
  };

  const getNormalizedImageUrl = (url: string) => {
    if (!url) return "";
    // If it's a Google Drive link, normalize to the thumbnail format
    if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
      // Extract ID from various formats: ?id=..., /d/..., or etc.
      const match = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?sz=w600&id=${match[1]}`;
      }
    }
    return url;
  };

  const formatDatePickerValue = (dateStr: string) => {
    if (!dateStr) return "";
    // If it's already YYYY-MM-DD, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // If it's DD/MM/YYYY, convert to YYYY-MM-DD
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
  };

  const handleExport = () => {
    const headers = ["Employee Code", "Username", "Email", "Phone", "Role", "DOB", "Anniversary Date", "Date of Joining", "Office", "Designation", "Department", "Coordinates"];
    const rows = sortedUsers.map(u => [
      u.id,
      u.username,
      u.email,
      u.phone || "",
      u.role_name || "USER",
      u.dob || "",
      u.anniversary_date || "",
      u.doj || "",
      u.office || "",
      u.designation || "",
      u.department || "",
      u.late_long || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setIsConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!pendingDeleteId) return;

    // Show loading
    setActionStatus('loading');
    setActionMessage("Removing user from system...");
    setIsStatusModalOpen(true);

    try {
      const res = await fetch(`/api/users/${pendingDeleteId}`, { method: "DELETE" });
      if (res.ok) {
        setIsStatusModalOpen(false); // Close loader immediately
        fetchUsers();
      } else {
        throw new Error("Delete failed");
      }
    } catch (error) {
      setIsStatusModalOpen(false); // Close loader on error too
      alert("Failed to delete user. Please try again.");
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handlePermissionToggle = async (userId: string, pageId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const currentPermissions = user.permissions || [];
    const newPermissions = currentPermissions.includes(pageId)
      ? currentPermissions.filter(p => p !== pageId)
      : [...currentPermissions, pageId];

    // Optimistic update
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, permissions: newPermissions } : u
    ));

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...user, permissions: newPermissions }),
      });

      if (!res.ok) throw new Error("Failed to update permissions");
    } catch (error) {
      console.error(error);
      // Revert on error
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, permissions: currentPermissions } : u
      ));
      alert("Failed to update permission. Please try again.");
    }
  };

  const filteredUsers = Array.isArray(users) ? users.filter((u) =>
    Object.values(u).some((val) =>
      val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) : [];

  const handleSort = (key: keyof User) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    let aValue = a[key] || "";
    let bValue = b[key] || "";
    
    // Alphanumeric sort for ID (e.g., RE080, RA001)
    if (key === 'id') {
      const aStr = String(aValue);
      const bStr = String(bValue);
      const aNumMatch = aStr.match(/\d+/);
      const bNumMatch = bStr.match(/\d+/);
      
      if (aNumMatch && bNumMatch) {
        const aNum = parseInt(aNumMatch[0], 10);
        const bNum = parseInt(bNumMatch[0], 10);
        if (aNum !== bNum) {
          return direction === 'asc' ? aNum - bNum : bNum - aNum;
        }
      }
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ column }: { column: keyof User }) => {
    if (sortConfig?.key !== column) return <div className="w-3 h-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? 
      <ChevronUpIcon className="w-3 h-3 ml-1 text-[#2563EB]" /> : 
      <ChevronDownIcon className="w-3 h-3 ml-1 text-[#2563EB]" />;
  };

  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = sortedUsers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Sticky Top Header & Tabs */}
      <div className="space-y-4 mb-2">
        {/* Standalone Title Row */}
        <div className="flex flex-col lg:flex-row items-center gap-4 px-1">
        <div className="w-full lg:w-1/3 text-center lg:text-left min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Users</h1>
          <p className="text-gray-500 dark:text-slate-300 font-bold text-[12px] md:text-[10px] tracking-wider">System Access Control</p>
        </div>
        
        <div className="w-full lg:w-1/3 flex justify-center flex-shrink-0 min-w-0">
          {/* Single Cylinder Container for All Actions */}
          <div className="flex items-center gap-1 rounded-full border-2 border-b-4 border-[#2563EB] dark:border-[#60A5FA] bg-white dark:bg-navy-800 shadow-sm transition-all active:translate-y-[2px] active:border-b-2 p-1 overflow-x-auto no-scrollbar max-w-full">
            {/* Tab: User List */}
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-3 md:px-5 py-1.5 font-semibold   text-[13px] md:text-[10px] transition-all rounded-full whitespace-nowrap ${
                activeTab === 'list' 
                ? 'bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black shadow-md' 
                : 'text-[#5B6472] dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
              }`}
              title="User List"
            >
              <UsersIcon className="w-4 h-4" />
              <span className="hidden sm:inline">User List</span>
              <span className="sm:hidden">List</span>
            </button>
            
            {/* Tab: Page Visibility */}
            <button
              onClick={() => setActiveTab('visibility')}
              className={`flex items-center gap-2 px-3 md:px-5 py-1.5 font-semibold   text-[13px] md:text-[10px] transition-all rounded-full whitespace-nowrap ${
                activeTab === 'visibility' 
                ? 'bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black shadow-md' 
                : 'text-[#5B6472] dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
              }`}
              title="Page Visibility"
            >
              <EyeIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Page Visibility</span>
              <span className="sm:hidden">Access</span>
            </button>

            {/* Action: Export */}
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 text-[#2563EB] dark:text-[#60A5FA] px-3 md:px-5 py-1.5 font-semibold transition-colors hover:bg-gray-100 dark:hover:bg-navy-700 text-[13px] md:text-[10px] rounded-full whitespace-nowrap"
              title="Export to CSV"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            
            {/* Action: Add User */}
            <button
              onClick={() => {
                setEditingUser(null);
                setFormData({
                  id: nextEmpCode(),
                  username: "",
                  email: "",
                  password: "",
                  phone: "",
                  role_name: "",
                  locations: [{ name: "Main", coords: "" }],
                  isActive: true
                });
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center hover:bg-gray-100 dark:hover:bg-navy-700 text-[#2563EB] dark:text-[#60A5FA] px-3 py-1.5 transition-colors rounded-full"
              title="Add User"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="hidden lg:block lg:w-1/3"></div>
      </div>
    </div>

      {activeTab === 'list' ? (
        <div 
          style={{ borderColor: 'var(--panel-border)' }}
          className="rounded-2xl border overflow-hidden shadow-sm transition-all duration-500"
        >
          {/* Integrated Search & Pagination Row */}
          <div 
            style={{ 
              backgroundColor: 'var(--panel-card)',
              borderBottom: '1px solid var(--panel-border)',
            }}
            className="px-3 md:px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="relative group flex-1 max-w-full lg:max-w-sm">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6472] group-focus-within:text-[#2563EB] transition-colors" />
              <input
                type="text"
                placeholder="Search database..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-gray-50 dark:bg-navy-900 border border-gray-100 dark:border-navy-700/50 rounded-lg focus:border-[#2563EB] outline-none font-bold text-[13px] text-gray-700 dark:text-white transition-all shadow-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              <div className="flex items-center gap-2">
                <p className="text-[13px] md:text-[10px] font-semibold text-[#5B6472] whitespace-nowrap">
                  Page <span className="text-[#2563EB] dark:text-[#60A5FA]">{currentPage}</span> of {totalPages || 1}
                </p>
                <div className="flex gap-0.5">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-1.5 py-1 text-[13px] md:text-[10px] font-bold text-[#5B6472] hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all whitespace-nowrap">First</button>
                  <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 text-[#5B6472] hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all"><ChevronLeftIcon className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1 text-[#5B6472] hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all"><ChevronRightIcon className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="px-1.5 py-1 text-[13px] md:text-[10px] font-bold text-[#5B6472] hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-all whitespace-nowrap">Last</button>
                </div>
              </div>
              <div className="hidden xs:block h-4 w-[1px] bg-gray-200 dark:bg-white/10" />
              <div className="flex items-center gap-2">
                <label className="text-[13px] md:text-[10px] font-semibold text-[#5B6472]">Show</label>
                <select 
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-transparent border-none p-0 text-[13px] font-bold outline-none dark:text-white cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>
          {/* Table Section - Direct continuation of controls */}
          <div 
            style={{ backgroundColor: 'var(--panel-card)' }}
            className="overflow-x-auto transition-colors duration-500"
          >
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr 
                className="bg-[#2563EB] dark:bg-navy-950 text-white dark:text-slate-200"
              >
                <th onClick={() => handleSort('id')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="flex items-center">Emp. Code <SortIcon column="id" /></div>
                </th>
                <th onClick={() => handleSort('username')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="flex items-center">Details <SortIcon column="username" /></div>
                </th>
                <th onClick={() => handleSort('phone')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden md:table-cell">
                  <div className="flex items-center">Contact <SortIcon column="phone" /></div>
                </th>
                <th onClick={() => handleSort('office')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden lg:table-cell">
                  <div className="flex items-center">Office <SortIcon column="office" /></div>
                </th>
                <th onClick={() => handleSort('role_name')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden lg:table-cell">
                  <div className="flex items-center">Role <SortIcon column="role_name" /></div>
                </th>
                <th onClick={() => handleSort('department')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden xl:table-cell">
                  <div className="flex items-center">Dept/Desig <SortIcon column="department" /></div>
                </th>
                <th onClick={() => handleSort('dob')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden lg:table-cell">
                  <div className="flex items-center">Dob <SortIcon column="dob" /></div>
                </th>
                <th onClick={() => handleSort('anniversary_date')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden lg:table-cell">
                  <div className="flex items-center">Anniv. <SortIcon column="anniversary_date" /></div>
                </th>
                <th onClick={() => handleSort('doj')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden lg:table-cell">
                  <div className="flex items-center">Doj <SortIcon column="doj" /></div>
                </th>
                <th onClick={() => handleSort('late_long')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors hidden xl:table-cell">
                  <div className="flex items-center">Site Locations <SortIcon column="late_long" /></div>
                </th>
                <th onClick={() => handleSort('isActive')} className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="flex items-center">Status <SortIcon column="isActive" /></div>
                </th>
                <th className="px-3 md:px-4 py-3 text-[13px] md:text-[10px] font-semibold text-right">Actions</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center">
                  <div className="w-6 h-6 border-2 border-gray-100 border-t-[#2563EB] rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-[#5B6472] font-bold text-[12px]">Syncing...</p>
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center">
                  <p className="text-[14px] text-[#5B6472] font-bold">No entries found</p>
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-[#F7F8FA] border-b-2 border-gray-200 dark:border-white/10 last:border-0 transition-colors group">
                  <td className="px-3 md:px-4 py-3">
                    <span className="font-mono text-[13px] md:text-sm text-gray-900 dark:text-white font-semibold">{user.id}</span>
                  </td>
                  <td className="px-3 md:px-4 py-3">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gray-50 dark:bg-zinc-800 overflow-hidden border border-gray-100 dark:border-zinc-700 flex-shrink-0">
                        {user.image_url ? (
                          <img 
                            src={getNormalizedImageUrl(user.image_url)} 
                            alt={user.username} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random&color=fff&length=2`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-semibold text-[#5B6472] dark:text-zinc-500 text-[13px]">
                            {user.username?.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[14px] md:text-xs text-gray-900 dark:text-white leading-tight truncate">{user.username}</p>
                        <p className="text-[13px] md:text-[10px] text-[#5B6472] dark:text-slate-400 font-bold lowercase truncate max-w-[80px] md:max-w-[120px]">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden md:table-cell">
                    <p className="text-[14px] md:text-xs font-bold text-gray-600 dark:text-slate-300">{user.phone || "—"}</p>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden lg:table-cell">
                    <span className="px-1.5 md:px-2 py-0.5 bg-[#2563EB]/5 dark:bg-[#60A5FA]/10 text-white dark:text-[#60A5FA] text-[12px] md:text-[9px] font-semibold rounded border border-[#E5E7EB] dark:border-[#60A5FA]/20">
                      {user.office || "—"}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden lg:table-cell">
                    <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 bg-[#F7F8FA] dark:bg-[#60A5FA]/10 text-[#DC2626] dark:text-[#60A5FA] text-[12px] md:text-[10px] font-semibold rounded-md border border-[#E5E7EB] dark:border-[#60A5FA]/20">
                      {user.role_name || "MEMBER"}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden xl:table-cell">
                    <div className="min-w-0">
                      <p className="font-semibold text-[13px] md:text-[11px] text-gray-900 dark:text-white leading-tight truncate">{user.department || "—"}</p>
                      <p className="text-[13px] text-[#2563EB] dark:text-[#60A5FA] font-bold tracking-wider truncate">{user.designation || "—"}</p>
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden lg:table-cell">
                    <p className="text-[14px] md:text-xs font-bold text-gray-600 dark:text-slate-300">{user.dob || "—"}</p>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden lg:table-cell">
                    <p className="text-[14px] md:text-xs font-bold text-gray-600 dark:text-slate-300">{user.anniversary_date || "—"}</p>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden lg:table-cell">
                    <p className="text-[14px] md:text-xs font-bold text-gray-600 dark:text-slate-300">{user.doj || "—"}</p>
                  </td>
                  <td className="px-3 md:px-4 py-3 hidden xl:table-cell">
                    <div className="flex flex-col gap-1">
                      {(() => {
                        try {
                          if (user.late_long && (user.late_long.startsWith('[') || user.late_long.startsWith('{'))) {
                            const locs = JSON.parse(user.late_long);
                            return locs.map((l: any, i: number) => (
                              <p key={i} className="text-[13px] font-bold text-[#5B6472] dark:text-slate-500 font-mono italic truncate max-w-[150px]">
                                <span className="text-[#2563EB] dark:text-[#60A5FA] not-italic mr-1">{l.name}:</span>
                                {l.coords || "—"}
                              </p>
                            ));
                          }
                          return <p className="text-[14px] md:text-xs font-bold text-[#5B6472] dark:text-slate-500 font-mono italic">{user.late_long || "—"}</p>;
                        } catch (e) {
                          return <p className="text-[14px] md:text-xs font-bold text-[#5B6472] dark:text-slate-500 font-mono italic">{user.late_long || "—"}</p>;
                        }
                      })()}
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[12px] font-semibold   border ${
                      user.isActive 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-1.5 bg-[#2563EB]/10 text-white dark:bg-[#60A5FA]/10 dark:text-[#60A5FA] hover:bg-[#2563EB] hover:text-white dark:hover:bg-[#60A5FA] dark:hover:text-black rounded-lg transition-all"
                        title="Edit User"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user.id)}
                        className="p-1.5 bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626] hover:text-white rounded-lg transition-all"
                        title="Delete User"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
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
      ) : (
        /* Page Visibility Matrix */
        <div 
          style={{ borderColor: 'var(--panel-border)', backgroundColor: 'var(--panel-card)' }}
          className="rounded-2xl border overflow-hidden shadow-sm transition-all duration-500"
        >
          {/* Integrated Search Row */}
          <div 
            style={{ 
              backgroundColor: 'var(--panel-card)',
              borderBottom: '1px solid var(--panel-border)',
            }}
            className="px-3 md:px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="relative group flex-1 max-w-full lg:max-w-sm">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6472] group-focus-within:text-[#2563EB] transition-colors" />
              <input
                type="text"
                placeholder="Search user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-gray-50 dark:bg-navy-900 border border-gray-100 dark:border-navy-700/50 rounded-lg focus:border-[#2563EB] outline-none font-bold text-[13px] text-gray-700 dark:text-white transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh] no-scrollbar">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-[#2563EB] dark:bg-navy-950 text-white dark:text-slate-200">
                  <th className="px-3 md:px-6 py-3 md:py-4 text-[13px] md:text-[10px] font-semibold border-r border-white/10 w-40 md:w-64 sticky left-0 top-0 bg-[#2563EB] dark:bg-navy-950 z-30">User Name</th>
                  {navigation.map(page => (
                    <th key={page.id} className="px-3 md:px-6 py-3 md:py-4 text-[13px] md:text-[10px] font-semibold text-center whitespace-nowrap sticky top-0 bg-[#2563EB] dark:bg-navy-950 z-20">
                      {page.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-[#F7F8FA] transition-colors group">
                    <td className="px-3 md:px-6 py-3 md:py-4 border-r border-gray-200 dark:border-white/10 sticky left-0 bg-white dark:bg-[#131C2E] z-10">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gray-50 dark:bg-zinc-800 overflow-hidden border border-gray-100 dark:border-zinc-700 flex-shrink-0">
                          {user.image_url ? (
                            <img 
                              src={getNormalizedImageUrl(user.image_url)} 
                              alt={user.username} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-semibold text-[#5B6472] dark:text-zinc-500 text-[13px]">
                              {user.username?.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[14px] md:text-sm text-gray-900 dark:text-white leading-tight truncate">{user.username}</p>
                          <p className="text-[13px] text-[#5B6472] font-bold tracking-wider truncate">{user.role_name || "MEMBER"}</p>
                        </div>
                      </div>
                    </td>
                    {navigation.map(page => (
                      <td key={page.id} className="px-6 py-4 text-center">
                        <button
                          onClick={() => handlePermissionToggle(user.id, page.id)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all transform active:scale-90 ${
                            user.permissions?.includes(page.id)
                              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 rotate-0"
                              : "bg-gray-100 dark:bg-white/5 text-[#5B6472] dark:text-gray-700 hover:bg-gray-200 dark:hover:bg-white/10"
                          }`}
                        >
                          <CheckIcon className={`w-3.5 h-3.5 transition-all duration-300 ${
                            user.permissions?.includes(page.id) ? "scale-100 opacity-100" : "scale-75 opacity-50"
                          }`} />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-[#FFFFFF] dark:bg-navy-900 w-full max-w-xl rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-white/10 overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-4 border-b border-[#E5E7EB] dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
                  {editingUser ? "Edit User" : "Add New User"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[#5B6472] dark:text-slate-400 font-bold text-[12px]">Profile Configuration</p>
                  {editingUser && (
                    <span className="px-2 py-0.5 bg-[#F7F8FA] dark:bg-zinc-800 text-[12px] font-semibold text-gray-500 rounded border border-[#E5E7EB] dark:border-zinc-700">
                      User Profile
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                className="p-2 text-[#5B6472] hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
              >
                <XMarkIcon className="w-8 h-8" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto bg-white dark:bg-navy-800/50">
              {/* Profile Image Upload */}
              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-navy-950/50 rounded-2xl border-2 border-dashed border-gray-100 dark:border-navy-800 group transition-all">
                <div className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-navy-800 ring-4 ring-[#E5E7EB] dark:ring-navy-900 group-hover:scale-105 transition-all">
                  {imagePreview ? (
                    <img 
                      src={getNormalizedImageUrl(imagePreview)} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#F7F8FA] dark:bg-navy-800 flex items-center justify-center text-[#D97706] dark:text-navy-700 font-semibold text-3xl">
                      {formData.username?.substring(0, 2).toUpperCase() || "UR"}
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <PlusIcon className="w-8 h-8 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedImage(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                </div>
                <p className="text-[13px] font-semibold text-[#5B6472] mt-3">Click Avatar to Update Photo</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {/* Section: basic Info */}
                <div className="md:col-span-2">
                  <p className="text-[13px] font-semibold text-[#2563EB] mb-1">Basic Information</p>
                  <div className="h-0.5 w-10 bg-[#2563EB] rounded-full mb-4"></div>
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-[#5B6472] block mb-2">Employee Code</label>
                  <input
                    type="text"
                    value={formData.id}
                    readOnly={!editingUser}
                    onChange={(e) => editingUser && setFormData({ ...formData, id: e.target.value })}
                    className={`w-full px-3 py-1.5 rounded-lg border focus:border-[#2563EB] outline-none font-bold text-[14px] transition-all shadow-sm ${
                      !editingUser
                        ? 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 cursor-not-allowed border-[#E5E7EB] dark:border-zinc-800'
                        : 'bg-[#FFFFFF] dark:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 text-gray-800 dark:text-zinc-100'
                    } ${
                      users.some(u => u.id === formData.id && u.id !== editingUser?.id)
                        ? 'border-red-500'
                        : 'border-[#E5E7EB] dark:border-zinc-800'
                    }`}
                    placeholder="Auto-generated"
                    required
                  />
                  {!editingUser && (
                    <p className="mt-1 text-[13px] font-semibold text-[#5B6472]">
                      🔒 Auto-generated unique code
                    </p>
                  )}
                  {(() => {
                    const existingUser = users.find(u => u.id === formData.id && u.id !== editingUser?.id);
                    if (existingUser) {
                      return (
                        <p className="mt-1 text-[13px] font-semibold text-red-500 animate-pulse">
                          ⚠️ This ID is already used by {existingUser.username}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-[#5B6472] block mb-2">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                    placeholder="Enter Username"
                    required
                  />
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-[#5B6472] block mb-2">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                    placeholder="example@domain.com"
                    required
                  />
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-[#5B6472] block mb-2">
                    {editingUser ? "New password" : "Password"}
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                    placeholder={editingUser ? "Leave blank to keep the current password" : "Set a password"}
                  />
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-[#5B6472] block mb-2">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                    placeholder="+91-0000000000"
                  />
                </div>

                <PremiumDatePicker 
                  label="Date of Birth"
                  value={formData.dob || ""}
                  onChange={(val) => setFormData({ ...formData, dob: val })}
                  allowPast={true}
                />

                <PremiumDatePicker 
                  label="Anniversary Date"
                  value={formData.anniversary_date || ""}
                  onChange={(val) => setFormData({ ...formData, anniversary_date: val })}
                  allowPast={true}
                />

                <PremiumDatePicker 
                  label="Date Of Joining"
                  value={formData.doj || ""}
                  onChange={(val) => setFormData({ ...formData, doj: val })}
                  allowPast={true}
                />

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-navy-950/50 rounded-xl border border-gray-100 dark:border-navy-800/50">
                  <div>
                    <label className="text-[13px] font-semibold text-[#5B6472] block">Account Status</label>
                    <p className="text-[13px] font-bold text-gray-500">Active / Inactive</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      formData.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-navy-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-navy-950/50 rounded-xl border border-gray-100 dark:border-navy-800/50">
                  <div>
                    <label className="text-[13px] font-semibold text-[#5B6472] block">Track Attendance</label>
                    <p className="text-[13px] font-bold text-gray-500">Off for staff tracked elsewhere (e.g. factory scanner)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, trackAttendance: formData.trackAttendance === false ? true : false })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      formData.trackAttendance !== false ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-navy-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.trackAttendance !== false ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Section: Professional Details */}
                <div className="md:col-span-2 mt-2">
                  <p className="text-[13px] font-semibold text-[#2563EB] mb-1">Professional Details</p>
                  <div className="h-0.5 w-10 bg-[#2563EB] rounded-full mb-4"></div>
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-[#5B6472] block mb-2">Office Branch</label>
                  <select
                    value={formData.office}
                    onChange={(e) => setFormData({ ...formData, office: e.target.value })}
                    className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                  >
                    <option value="">Select Office</option>
                    <option value="GTK">GTK</option>
                    <option value="Kundli">Kundli</option>
                    <option value="KB">KB</option>
                    <option value="Shalimar Bagh">Shalimar Bagh</option>
                  </select>
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-[#5B6472] block mb-2">Role Name</label>
                  <select
                    value={formData.role_name}
                    onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                    className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                  >
                    <option value="">Select Role</option>
                    <option value="ADMIN">Admin</option>
                    <option value="USER">User</option>
                    <option value="EA">EA</option>
                    <option value="SALES">Sales</option>
                    <option value="CRM">CRM</option>
                  </select>
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-[#5B6472] block mb-2 flex items-center justify-between">
                    Department
                    <button type="button" onClick={() => setIsAddingOption({ type: 'department', isOpen: true })} className="p-1 hover:bg-[#2563EB]/10 rounded-full transition-colors"><PlusIcon className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA]" /></button>
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                  >
                    <option value="">Select Department</option>
                    {dropdowns.departments.map((dept, i) => (
                      <option key={i} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[13px] font-semibold text-[#5B6472] block mb-2 flex items-center justify-between">
                    Designation
                    <button type="button" onClick={() => setIsAddingOption({ type: 'designation', isOpen: true })} className="p-1 hover:bg-[#2563EB]/10 rounded-full transition-colors"><PlusIcon className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA]" /></button>
                  </label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                  >
                    <option value="">Select Designation</option>
                    {dropdowns.designations.map((desig, i) => (
                      <option key={i} value={desig}>{desig}</option>
                    ))}
                  </select>
                </div>


                {/* Full Width Fields: Multiple Locations */}
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[#2563EB]">User Site Locations</p>
                    <button
                      type="button"
                      onClick={addLocation}
                      className="px-3 py-1 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black rounded-lg font-semibold text-[12px] shadow-sm active:scale-95 transition-all"
                    >
                      + Add Site
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(formData.locations || []).map((loc, index) => (
                      <div key={index} className="p-3 bg-gray-50 dark:bg-navy-950/50 rounded-xl border border-gray-100 dark:border-navy-800/50">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-4">
                            <label className="text-[12px] font-semibold text-[#5B6472] block mb-1.5">Site Name</label>
                            <input
                              type="text"
                              value={loc.name}
                              onChange={(e) => updateLocation(index, 'name', e.target.value)}
                              placeholder="e.g. Work, Site A"
                              className="w-full bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-zinc-800 focus:border-[#2563EB] outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                            />
                          </div>
                          <div className="md:col-span-8 flex gap-2">
                            <div className="flex-1">
                              <label className="text-[12px] font-semibold text-[#5B6472] block mb-1.5">Coordinates</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={loc.coords}
                                  onChange={(e) => updateLocation(index, 'coords', e.target.value)}
                                  className="w-full bg-white dark:bg-zinc-900 pl-3 pr-8 py-1.5 rounded-lg border border-gray-100 dark:border-zinc-800 focus:border-[#2563EB] outline-none font-bold text-[14px] text-gray-800 dark:text-zinc-100 transition-all shadow-sm"
                                  placeholder="e.g., 28.6139, 77.2090"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleViewOnMap(loc.coords)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#5B6472] hover:text-[#2563EB] dark:hover:text-[#60A5FA] transition-colors"
                                >
                                  <GlobeAmericasIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="flex gap-1.5 pt-4">
                              <button
                                type="button"
                                onClick={() => handleFetchLocation(index)}
                                className="p-2 bg-[#2563EB]/10 text-white dark:bg-[#60A5FA]/10 dark:text-[#60A5FA] hover:bg-[#2563EB] hover:text-white dark:hover:bg-[#60A5FA] dark:hover:text-black rounded-lg transition-all"
                                title="Auto Fetch"
                              >
                                <MapPinIcon className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLocation(index)}
                                className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                title="Remove Site"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[#E5E7EB] dark:border-zinc-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-xl font-semibold text-[#5B6472] hover:text-gray-600 hover:bg-gray-50 transition-all text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#DC2626] hover:bg-[#8E161D] text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-lg active:scale-95 text-[13px]"
                >
                  {editingUser ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add New Dropdown Option Modal */}
      {isAddingOption.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddingOption({ ...isAddingOption, isOpen: false })} />
          <div className="relative bg-white dark:bg-navy-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/10 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight mb-4">
              Add New {isAddingOption.type}
            </h3>
            <input 
              type="text" 
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              placeholder={`Enter new ${isAddingOption.type} name`}
              className="w-full bg-gray-50 dark:bg-zinc-950 px-4 py-2 rounded-xl border border-gray-100 dark:border-zinc-800 focus:border-[#2563EB] outline-none font-bold text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setIsAddingOption({ ...isAddingOption, isOpen: false })}
                className="flex-1 py-2 font-semibold text-[13px] text-[#5B6472] hover:text-gray-600"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddDropdownOption}
                className="flex-1 bg-[#2563EB] dark:bg-[#60A5FA] text-white dark:text-black py-2 rounded-xl font-semibold text-[13px] shadow-lg"
              >
                Add Option
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Action Status Modal */}
      <ActionStatusModal 
        isOpen={isStatusModalOpen}
        status={actionStatus}
        message={actionMessage}
      />

      {/* Confirmation Modal */}
      <ConfirmModal 
        isOpen={isConfirmOpen}
        title="Delete User?"
        message="This action cannot be undone. All user data will be permanently removed from the system."
        confirmLabel="Delete User"
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={performDelete}
      />
    </div>
  );
}
