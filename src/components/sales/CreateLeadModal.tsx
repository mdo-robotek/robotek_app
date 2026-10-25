import { useState, useEffect } from "react";
import { 
  XMarkIcon,
  UserIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  MapPinIcon,
  MapIcon,
  GlobeAltIcon,
  BriefcaseIcon,
  CubeIcon,
  MegaphoneIcon,
  IdentificationIcon,
  CurrencyRupeeIcon,
  ChartBarIcon,
  TagIcon
} from "@heroicons/react/24/outline";
import Portal from "@/components/Portal";
import ActionStatusModal from "@/components/ActionStatusModal";

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leadToEdit?: any | null;
}

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", 
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", 
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const LEAD_SOURCES = [
  "Magzine", "call", "website", "Direct", "India Mart", "Just Dial", 
  "WhatsApp Incoming", "Drip Marketing", "Walk In", "Reference", 
  "Instagram", "Corporate lead", "Google Map"
];

export default function CreateLeadModal({ isOpen, onClose, onSuccess, leadToEdit }: CreateLeadModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    status: 'loading' | 'success' | 'error';
    message: string;
  }>({ isOpen: false, status: 'loading', message: '' });
  const [users, setUsers] = useState<any[]>([]);
  
  const defaultFormData = {
    name: "",
    company_name: "",
    phone_number: "",
    area: "",
    state_and_ut: "",
    country: "India",
    enquiry_for: "",
    enquiry_products: "",
    sources_of_customer: "",
    sales_person_assigned: "",
    investment_amount: "",
    current_monthly_turnover: "",
    existing_products: "",
  };
  
  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => {
    if (isOpen) {
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
      
      if (leadToEdit) {
        setFormData({
          name: leadToEdit.name || "",
          company_name: leadToEdit.company_name || "",
          phone_number: leadToEdit.phone_number || "",
          area: leadToEdit.area || "",
          state_and_ut: leadToEdit.state_and_ut || "",
          country: leadToEdit.country || "India",
          enquiry_for: leadToEdit.enquiry_for || "",
          enquiry_products: leadToEdit.enquiry_products || "",
          sources_of_customer: leadToEdit.sources_of_customer || "",
          sales_person_assigned: leadToEdit.sales_person_assigned || "",
          investment_amount: leadToEdit.investment_amount || "",
          current_monthly_turnover: leadToEdit.current_monthly_turnover || "",
          existing_products: leadToEdit.existing_products || "",
        });
      } else {
        setFormData(defaultFormData);
      }
    }
  }, [isOpen, leadToEdit]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusModal({ isOpen: true, status: 'loading', message: leadToEdit ? 'Updating Lead...' : 'Creating Lead...' });
    try {
      const url = leadToEdit ? `/api/sales/${leadToEdit.id}` : "/api/sales";
      const method = leadToEdit ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setStatusModal({ isOpen: true, status: 'success', message: leadToEdit ? 'Lead updated successfully!' : 'Lead created successfully!' });
        setTimeout(() => {
          onSuccess();
          setStatusModal(prev => ({ ...prev, isOpen: false }));
        }, 1500);
      } else {
        setStatusModal({ isOpen: true, status: 'error', message: leadToEdit ? 'Failed to update lead' : 'Failed to create lead' });
      }
    } catch (error) {
      console.error(error);
      setStatusModal({ isOpen: true, status: 'error', message: 'Error submitting form' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-[#FFFFFF] dark:bg-navy-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-white/10 overflow-hidden animate-in fade-in zoom-in duration-300">
          
          <div className="p-4 border-b border-[#E5E7EB] dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">{leadToEdit ? `Edit Lead (${leadToEdit.id})` : 'Create New Lead'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[#5B6472] dark:text-slate-400 font-bold text-[12px]">Stage 1: Lead Details</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-[#5B6472] hover:text-gray-600 dark:hover:text-zinc-200 transition-colors">
              <XMarkIcon className="w-8 h-8" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-6 max-h-[80vh] overflow-y-auto bg-white dark:bg-navy-800/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><UserIcon className="w-3 h-3"/> Name</label>
                <input required name="name" value={formData.name} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm" placeholder="Contact Name" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><BuildingOfficeIcon className="w-3 h-3"/> Company Name</label>
                <input name="company_name" value={formData.company_name} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm" placeholder="Business Name" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><PhoneIcon className="w-3 h-3"/> Phone Number</label>
                <input required name="phone_number" value={formData.phone_number} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm" placeholder="10-digit number" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><MapPinIcon className="w-3 h-3"/> Area / City</label>
                <input name="area" value={formData.area} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm" placeholder="Locality" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><MapIcon className="w-3 h-3"/> State and UT</label>
                <select name="state_and_ut" value={formData.state_and_ut} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm">
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><GlobeAltIcon className="w-3 h-3"/> Country</label>
                <input name="country" value={formData.country} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm" placeholder="Country" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><BriefcaseIcon className="w-3 h-3"/> Enquiry For</label>
                <input name="enquiry_for" value={formData.enquiry_for} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm" placeholder="e.g. Dealership" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><CubeIcon className="w-3 h-3"/> Enquiry Products</label>
                <input name="enquiry_products" value={formData.enquiry_products} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm" placeholder="Products interested in" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><MegaphoneIcon className="w-3 h-3"/> Lead Source</label>
                <select name="sources_of_customer" value={formData.sources_of_customer} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm">
                  <option value="">Select Lead Source</option>
                  {LEAD_SOURCES.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><IdentificationIcon className="w-3 h-3"/> Sales Person Assigned</label>
                <select name="sales_person_assigned" value={formData.sales_person_assigned} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm">
                  <option value="">Select Sales Person</option>
                  {users.map(user => (
                    <option key={user.id || user.username} value={user.username}>{user.username}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><CurrencyRupeeIcon className="w-3 h-3"/> Investment Amount</label>
                <input name="investment_amount" value={formData.investment_amount} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm" placeholder="Investment Budget" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><ChartBarIcon className="w-3 h-3"/> Current Monthly Turnover</label>
                <input name="current_monthly_turnover" value={formData.current_monthly_turnover} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm" placeholder="Current Turnover" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[13px] font-semibold text-[#2563EB] flex items-center gap-1"><TagIcon className="w-3 h-3"/> Existing Products / Brands Selling</label>
                <input name="existing_products" value={formData.existing_products} onChange={handleChange} className="w-full bg-[#FFFFFF] dark:bg-zinc-900 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-zinc-800 focus:border-[#2563EB] focus:bg-white dark:focus:bg-zinc-900 outline-none font-semibold text-sm text-gray-900 dark:text-white transition-all shadow-sm" placeholder="Brands" />
              </div>
            </div>
            
            <button type="submit" disabled={isSubmitting} className="w-full px-4 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-[14px] font-semibold transition-all shadow-md mt-6 disabled:opacity-50">
              {isSubmitting ? "Saving..." : leadToEdit ? "Update Lead" : "Create Lead"}
            </button>
          </form>
        </div>
      </div>
      
      <ActionStatusModal
        isOpen={statusModal.isOpen}
        status={statusModal.status}
        message={statusModal.message}
        onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
      />
    </Portal>
  );
}
