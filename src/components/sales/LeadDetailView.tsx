import { useState, useEffect } from "react";
import { SalesLead, FollowUp } from "@/types/sales";
import {
  ArrowLeftIcon,
  TruckIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  MapPinIcon,
  CubeIcon,
  CurrencyRupeeIcon,
  ChartBarIcon,
  TagIcon,
  UserIcon,
  CalendarIcon,
  DocumentTextIcon,
  SparklesIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import ActionStatusModal from "@/components/ActionStatusModal";
import EventTimeline from "@/components/sales/EventTimeline";
import Portal from "@/components/Portal";

interface LeadDetailViewProps {
  lead: SalesLead;
  initialTab: 'transfer' | 'qualify' | 'global' | 'followup';
  onClose: () => void;
  onUpdate: () => void;
}

export default function LeadDetailView({ lead, initialTab, onClose, onUpdate }: LeadDetailViewProps) {
  const isTransferStage = !lead.qualified_status && (!lead.status || lead.status === 'Lead Generated');
  const isQualifyStage = (!lead.qualified_status || lead.qualified_status === 'Not Qualified') && lead.status && lead.status !== 'Lead Generated';
  const isFollowUpStage = lead.qualified_status === 'Qualified';

  const canAccessTransfer = isTransferStage;
  const canAccessQualify = isQualifyStage;
  const canAccessFollowUp = isFollowUpStage;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    status: 'loading' | 'success' | 'error';
    message: string;
  }>({ isOpen: false, status: 'loading', message: '' });
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState<Partial<SalesLead>>({});

  // Follow Up State
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [followUpFormData, setFollowUpFormData] = useState({
    next_follow_up_date: "",
    status: "",
    lead_time: "",
    remark: "",
    billing_date: "",
    billing_amount: "",
    ss_name: "",
    dealing_with: "",
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (e) {
        console.error("Failed to fetch users", e);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (lead) {
      setFormData({
        planned_time: lead.planned_time || "",
        actual_time: lead.actual_time || "",
        status: lead.status || "",
        sc_remark: lead.sc_remark || "",
        ss_remark: lead.ss_remark || "",
        party_remark: lead.party_remark || "",
        qualified_status: lead.qualified_status || "",
        qualified_timestamp: lead.qualified_timestamp || "",
        document_link: lead.document_link || "",
        remark: lead.remark || "",
        sales_coordinator_name: lead.sales_coordinator_name || "",
        lead_priority_type: lead.lead_priority_type || "",
      });
      fetchFollowUps();
    }
  }, [lead]);

  const fetchFollowUps = async () => {
    try {
      const res = await fetch(`/api/sales/follow-up?leadId=${lead.id}`);
      if (res.ok) {
        const data = await res.json();
        setFollowUps(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleLeadChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'qualified_status' && activeTab === 'qualify') {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);
        newData.qualified_timestamp = localISOTime;
      }
      return newData;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("folderId", "1rvnNJSOsWO0jJS3yzU4fFvZWK1OWb_wB");

      const res = await fetch("/api/sales/upload", {
        method: "POST",
        body: uploadData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.fileId) {
          const fileLink = `https://drive.google.com/file/d/${data.fileId}/view`;
          setFormData(prev => ({ ...prev, document_link: fileLink }));
        }
      } else {
        alert("Failed to upload document");
      }
    } catch (error) {
      console.error(error);
      alert("Error uploading document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusModal({ isOpen: true, status: 'loading', message: 'Saving Updates...' });
    try {
      const payload = { ...formData };

      // Auto-set actual time when filling the Transfer entry
      if (activeTab === 'transfer') {
        payload.actual_time = new Date().toISOString();
      }

      const res = await fetch(`/api/sales/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setStatusModal({ isOpen: true, status: 'success', message: 'Lead updated successfully!' });
        setTimeout(() => {
          onUpdate();
          setStatusModal(prev => ({ ...prev, isOpen: false }));
        }, 1500);
      } else {
        setStatusModal({ isOpen: true, status: 'error', message: 'Failed to update lead' });
      }
    } catch (error) {
      console.error(error);
      setStatusModal({ isOpen: true, status: 'error', message: 'Error updating lead' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFollowUpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFollowUpFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusModal({ isOpen: true, status: 'loading', message: 'Logging Follow Up...' });
    try {
      let calculatedNextDate = followUpFormData.next_follow_up_date;
      if (followUpFormData.lead_time) {
        const days = parseInt(followUpFormData.lead_time) || 0;
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + days);
        calculatedNextDate = nextDate.toISOString();
      }

      const payload = { 
        ...followUpFormData, 
        lead_id: lead.id,
        next_follow_up_date: calculatedNextDate
      };
      
      const res = await fetch("/api/sales/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setStatusModal({ isOpen: true, status: 'success', message: 'Follow up added successfully!' });
        setTimeout(() => {
          setFollowUpFormData({
            next_follow_up_date: "", status: "", lead_time: "",
            remark: "", billing_date: "", billing_amount: "", ss_name: "", dealing_with: ""
          });
          fetchFollowUps();
          onUpdate(); // refresh pipeline data
          setStatusModal(prev => ({ ...prev, isOpen: false }));
        }, 1500);
      } else {
        setStatusModal({ isOpen: true, status: 'error', message: 'Failed to add follow up' });
      }
    } catch (error) {
      console.error(error);
      setStatusModal({ isOpen: true, status: 'error', message: 'Error submitting follow up' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'transfer':
        return (
          <form onSubmit={handleLeadSubmit} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 gap-3">

              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#2563EB] block">Status</label>
                <select name="status" value={formData.status || ""} onChange={handleLeadChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm">
                  <option value="">Select Status...</option>
                  <option value="In Process">In Process</option>
                  <option value="Transfer to SS">Transfer to SS</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#2563EB] block">SC Remark</label>
                <input name="sc_remark" value={formData.sc_remark || ""} onChange={handleLeadChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#2563EB] block">SS Remark</label>
                <input name="ss_remark" value={formData.ss_remark || ""} onChange={handleLeadChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#2563EB] block">Party Remark</label>
                <input name="party_remark" value={formData.party_remark || ""} onChange={handleLeadChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all" />
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full px-3 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-[14px] font-semibold transition-all shadow-md mt-4 disabled:opacity-50">
              {isSubmitting ? "Saving..." : "Save Transfer Updates"}
            </button>
          </form>
        );
      case 'qualify':
        return (
          <form onSubmit={handleLeadSubmit} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#2563EB] block">Qualification Status</label>
                <select name="qualified_status" value={formData.qualified_status || ""} onChange={handleLeadChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all">
                  <option value="">Select Status...</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Not Qualified">Not Qualified</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#2563EB] block">Qualification Timestamp (Auto)</label>
                <input type="datetime-local" readOnly name="qualified_timestamp" value={formData.qualified_timestamp || ""} className="w-full bg-gray-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 outline-none font-semibold text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#2563EB] block">Document Link</label>
                <div className="flex gap-2">
                  {formData.document_link ? (
                    <div className="flex-1 flex gap-2">
                      <input readOnly value={formData.document_link} className="w-full bg-gray-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 outline-none font-semibold text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed" />
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, document_link: "" }))} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[14px] font-bold transition-colors">Clear</button>
                    </div>
                  ) : (
                    <input type="file" onChange={handleFileUpload} disabled={isUploading} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-[#2563EB] file:text-white hover:file:bg-[#1D4ED8] cursor-pointer" />
                  )}
                </div>
                {isUploading && <p className="text-[13px] text-blue-500 font-bold mt-1">Uploading document...</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#2563EB] block">Remark</label>
                <input name="remark" value={formData.remark || ""} onChange={handleLeadChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all" placeholder="Add remark" />
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full px-3 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-[14px] font-semibold transition-all shadow-md mt-4 disabled:opacity-50">
              {isSubmitting ? "Saving..." : "Save Qualification Updates"}
            </button>
          </form>
        );
      case 'global':
        return (
          <form onSubmit={handleLeadSubmit} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#2563EB] block">Sales Coordinator Name</label>
                <select name="sales_coordinator_name" value={formData.sales_coordinator_name || ""} onChange={handleLeadChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all">
                  <option value="">Select Coordinator...</option>
                  <option value="Self">Self</option>
                  {users.map(u => (
                    <option key={u.id || u.username} value={u.username}>{u.username}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#2563EB] block">Lead Priority Type</label>
                <div className="flex gap-2">
                  {['High', 'Medium', 'Low'].map(priority => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, lead_priority_type: priority }))}
                      className={`flex-1 py-2 rounded-lg text-[14px] font-semibold   transition-all ${formData.lead_priority_type === priority
                        ? (priority === 'High' ? 'bg-red-500 text-white shadow-md' : priority === 'Medium' ? 'bg-[#D97706] text-white shadow-md' : 'bg-green-500 text-white shadow-md')
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                        }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full px-3 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-[14px] font-semibold transition-all shadow-md mt-4 disabled:opacity-50">
              {isSubmitting ? "Saving..." : "Save Global Fields"}
            </button>
          </form>
        );
      case 'followup':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <form onSubmit={handleFollowUpSubmit} className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#2563EB] block">Lead Time (Days)</label>
                  <input type="number" required name="lead_time" value={followUpFormData.lead_time} onChange={handleFollowUpChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all" placeholder="Enter days for next follow up" min="0" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#2563EB] block">Status Update</label>
                  <select name="status" required value={followUpFormData.status} onChange={handleFollowUpChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all">
                    <option value="">Select Status...</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Lost">Lost</option>
                    <option value="Arrange Meeting">Arrange Meeting</option>
                    <option value="Demonstration">Demonstration</option>
                    <option value="Transferred to SS">Transferred to SS</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="1st billing">1st billing</option>
                    <option value="2nd Billing">2nd Billing</option>
                    <option value="3rd Billing">3rd Billing</option>
                    <option value="Potential Lead but not Interesting">Potential Lead but not Interesting</option>
                    <option value="Deal in Reserved Area">Deal in Reserved Area</option>
                    <option value="Existing Customer">Existing Customer</option>
                    <option value="Not Qualified Lead">Not Qualified Lead</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#2563EB] block">Remark</label>
                  <textarea rows={2} required name="remark" value={followUpFormData.remark} onChange={handleFollowUpChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all resize-none" placeholder="Enter follow-up details..." />
                </div>
                
                {(followUpFormData.status.toLowerCase().includes('billing')) && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-[#2563EB] block">Billing Date</label>
                      <input type="date" required name="billing_date" value={followUpFormData.billing_date} onChange={handleFollowUpChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-semibold text-[#2563EB] block">Billing Amount</label>
                      <input required name="billing_amount" value={followUpFormData.billing_amount} onChange={handleFollowUpChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all" placeholder="Amount" />
                    </div>
                  </>
                )}

                {followUpFormData.status === 'Transferred to SS' && (
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-[#2563EB] block">SS Name</label>
                    <input required name="ss_name" value={followUpFormData.ss_name} onChange={handleFollowUpChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all" placeholder="SS Name" />
                  </div>
                )}

                {followUpFormData.status === 'Existing Customer' && (
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-[#2563EB] block">Dealing With</label>
                    <input required name="dealing_with" value={followUpFormData.dealing_with} onChange={handleFollowUpChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all" placeholder="SS Name or Direct Robotek" />
                  </div>
                )}
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full px-3 py-2 bg-[#2563EB] hover:bg-[#e6c000] text-black rounded-xl text-[14px] font-semibold transition-all shadow-md mt-4 disabled:opacity-50">
                {isSubmitting ? "Logging..." : "Log Follow Up"}
              </button>
            </form>

          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[99999] flex justify-end overflow-hidden">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
        
        <div className="relative w-full md:w-1/2 bg-gray-50 dark:bg-navy-900 shadow-[-20px_0_50px_-12px_rgba(0,0,0,0.3)] flex flex-col animate-in slide-in-from-right duration-500 border-l border-gray-200 dark:border-navy-700">
          
          {/* Header */}
          <div className="bg-[#2563EB] dark:bg-[#1D4ED8] py-4 px-5 flex items-start justify-between text-white shrink-0 shadow-md">
            <div className="flex flex-col">
               <h2 className="text-lg font-semibold tracking-tight leading-snug break-words flex items-center gap-2">
                 <GlobeAltIcon className="w-5 h-5 text-[#2563EB]" /> Lead Actions
               </h2>
               <span className="text-[13px] text-blue-200 font-bold mt-1">{lead.name || 'Unnamed'} ({lead.id})</span>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-all shrink-0 ml-2">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-6">

            {/* Action Tabs */}
            <div className="w-full flex flex-col gap-4">
              <div className="bg-white dark:bg-navy-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-white/10">
                <div className="flex gap-2 p-1 bg-gray-50 dark:bg-black/20 rounded-2xl mb-4 overflow-x-auto no-scrollbar">
                  {canAccessTransfer && (
                    <button
                      onClick={() => setActiveTab('transfer')}
                      className={`flex items-center gap-2 flex-1 justify-center py-2 px-3 rounded-xl font-semibold   text-[13px] transition-all whitespace-nowrap ${activeTab === 'transfer' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800/50' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}
                    >
                      <TruckIcon className="w-4 h-4" /> Transfer
                    </button>
                  )}
                  {canAccessQualify && (
                    <button
                      onClick={() => setActiveTab('qualify')}
                      className={`flex items-center gap-2 flex-1 justify-center py-2 px-3 rounded-xl font-semibold   text-[13px] transition-all whitespace-nowrap ${activeTab === 'qualify' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 shadow-sm border border-purple-200 dark:border-purple-800/50' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}
                    >
                      <ShieldCheckIcon className="w-4 h-4" /> Qualify
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('global')}
                    className={`flex items-center gap-2 flex-1 justify-center py-2 px-3 rounded-xl font-semibold   text-[13px] transition-all whitespace-nowrap ${activeTab === 'global' ? 'bg-[#F7F8FA] text-[#D97706] dark:bg-[#FEF3C7] dark:text-[#D97706] shadow-sm border border-[#E5E7EB] dark:border-[#E5E7EB]' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}
                  >
                    <GlobeAltIcon className="w-4 h-4" /> Global
                  </button>
                  {canAccessFollowUp && (
                    <button
                      onClick={() => setActiveTab('followup')}
                      className={`flex items-center gap-2 flex-1 justify-center py-2 px-3 rounded-xl font-semibold   text-[13px] transition-all whitespace-nowrap ${activeTab === 'followup' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 shadow-sm border border-green-200 dark:border-green-800/50' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}
                    >
                      <ChatBubbleLeftRightIcon className="w-4 h-4" /> Follow Up
                    </button>
                  )}
                </div>

                <div>
                  {renderTabContent()}
                </div>
              </div>
            </div>

          {/* Full-width Follow Up History */}
          {activeTab === 'followup' && followUps.length > 0 && (
            <div className="w-full pt-4 border-t border-gray-100 dark:border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />
                Follow Up History
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                {[...followUps].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).map((event, idx) => {
                  const count = followUps.length - idx;
                  const v = count % 100;
                  const suffix = ["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th";
                  
                  return (
                  <div key={event.id || idx} className="relative flex flex-col w-[260px] flex-shrink-0">
                    <div className="flex items-center mb-4 relative z-10">
                      <div className={`w-8 h-8 rounded-full border-2 bg-white dark:bg-navy-900 flex items-center justify-center shrink-0 ${idx === 0 ? 'border-[#2563EB] text-yellow-600 dark:text-[#60A5FA] shadow-sm shadow-[#2563EB]/20' : 'border-[#E5E7EB] dark:border-zinc-700 text-[#5B6472]'}`}>
                        <span className="text-[13px] font-semibold">{count}{suffix}</span>
                      </div>
                      {idx !== followUps.length - 1 ? (
                        <div className="flex-1 h-0.5 bg-[#F7F8FA] dark:bg-zinc-800" />
                      ) : (
                        <div className="flex-1 h-0.5 bg-transparent" />
                      )}
                    </div>
                    <div className="bg-[#FFFFFF] dark:bg-navy-900 p-4 rounded-2xl shadow-sm border border-[#E5E7EB] dark:border-white/5 h-full">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-0.5 rounded text-[13px] font-semibold   ${event.status?.toLowerCase().includes('billing')
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : event.status?.toLowerCase().includes('lost') || event.status?.toLowerCase().includes('not')
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-[#2563EB]/10 text-white dark:bg-[#60A5FA]/10 dark:text-[#60A5FA]'
                          }`}>
                          {event.status || 'Status Not Provided'}
                        </span>
                        {idx === 0 && <span className="text-[12px] font-semibold text-white bg-[#2563EB]/10 px-1.5 rounded">Latest</span>}
                      </div>
                      <p className="text-[13px] font-semibold text-[#5B6472] mb-3">
                        {event.timestamp ? new Date(event.timestamp).toLocaleString("en-GB", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "—"}
                      </p>
                      <p className="text-[14px] font-medium text-gray-800 dark:text-gray-200 my-3 bg-white dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                        {event.remark || <span className="text-[#5B6472] italic">No remark.</span>}
                      </p>
                      <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-[#E5E7EB] dark:border-white/5">
                        <span className="text-[13px] font-semibold text-gray-500">By: {event.dealing_with || event.ss_name || 'Unknown'}</span>
                        {event.next_follow_up_date && (
                          <span className="text-[13px] font-semibold text-gray-500">Next: {new Date(event.next_follow_up_date).toLocaleString("en-GB", { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ); })}
              </div>
            </div>
          )}

            {/* Action Status Modal overlay should have a higher z-index */}
            <ActionStatusModal
              isOpen={statusModal.isOpen}
              status={statusModal.status}
              message={statusModal.message}
              onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
