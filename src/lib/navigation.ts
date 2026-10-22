import { 
  UsersIcon, 
  DocumentTextIcon,
  Squares2X2Icon,
  ClipboardDocumentListIcon,
  TicketIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  BriefcaseIcon,
  PhoneIcon,
  InboxIcon,
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  ComputerDesktopIcon,
  UserPlusIcon,
  FlagIcon
} from "@heroicons/react/24/outline";

export const navigation = [
  // Dashboard Section
  { name: 'Dashboard', id: 'dashboard', href: '/', icon: Squares2X2Icon, section: 'Dashboard' },
  { name: 'Metrix', id: 'metrix', href: '/metrix', icon: ChartBarIcon, section: 'Dashboard' },
  { name: 'Score', id: 'score', href: '/score', icon: ChartBarIcon, section: 'Dashboard' },
  { name: 'EA-MD Hub', id: 'ea-md-hub', href: '/ea-md-hub', icon: BriefcaseIcon, section: 'Dashboard' },

  // Task Section
  { name: 'Delegations', id: 'delegations', href: '/delegations', icon: DocumentTextIcon, section: 'Task' },
  { name: 'Checklists', id: 'checklists', href: '/checklists', icon: ClipboardDocumentListIcon, section: 'Task' },
  { name: 'Help Tickets', id: 'tickets', href: '/tickets', icon: TicketIcon, section: 'Task' },
  { name: 'Scheduler', id: 'scheduler', href: '/scheduler', icon: CalendarIcon, section: 'Task' },

  // HRMS Section
  { name: 'Users', id: 'users', href: '/users', icon: UsersIcon, section: 'HRMS' },
  { name: 'Attendance', id: 'attendance', href: '/attendance', icon: ClipboardDocumentListIcon, section: 'HRMS' },
  { name: 'Leave', id: 'leave', href: '/leave', icon: CalendarIcon, section: 'HRMS' },
  { name: 'Recruitment', id: 'hrms', href: '/hrms/recruitment', icon: BriefcaseIcon, section: 'HRMS' },
  { name: 'Candidate', id: 'hrms', href: '/hrms/candidate', icon: UserGroupIcon, section: 'HRMS' },
  { name: 'Sales HR', id: 'hrms', href: '/hrms/sales', icon: CurrencyDollarIcon, section: 'HRMS' },
  { name: 'Onboard', id: 'hrms', href: '/hrms/onboard', icon: UserPlusIcon, section: 'HRMS' },
  { name: 'Offboard', id: 'hrms', href: '/hrms/offboard', icon: BriefcaseIcon, section: 'HRMS' },

  // Sales & Field Section
  { name: 'Sales', id: 'sales', href: '/sales', icon: CurrencyDollarIcon, section: 'Sales & Field' },
  { name: 'Customer Target', id: 'customer-target', href: '/customer-target', icon: FlagIcon, section: 'Sales & Field' },
  { name: 'Field Tracking', id: 'field-driver', href: '/field-driver', icon: MapPinIcon, section: 'Sales & Field' },
  { name: 'Scot', id: 'scot', href: '/scot', icon: PhoneIcon, section: 'Sales & Field' },
  { name: 'Scot KB', id: 'scot-kb', href: '/scot-kb', icon: PhoneIcon, section: 'Sales & Field' },

  // Operations Section
  { name: 'O2D', id: 'o2d', href: '/o2d', icon: ShoppingBagIcon, section: 'Operations' },
  { name: 'O2D KB', id: 'o2dkb', href: '/o2dkb', icon: ShoppingBagIcon, section: 'Operations' },
  { name: 'I2R', id: 'i2r', href: '/i2r', icon: ArchiveBoxIcon, section: 'Operations' },
  { name: 'I2R Packing', id: 'i2r-packing', href: '/i2r-packing', icon: ArchiveBoxIcon, section: 'Operations' },
  { name: 'Item Receive (PACKING)', id: 'item-receive-packing', href: '/item-receive-packing', icon: ArchiveBoxIcon, section: 'Operations' },
  { name: 'Replace', id: 'replace', href: '/replace', icon: ArchiveBoxIcon, section: 'Operations' },
  { name: 'GRN', id: 'grn', href: '/grn', icon: ArrowDownTrayIcon, section: 'Operations' },
  { name: 'IMS', id: 'ims', href: '/ims', icon: InboxIcon, section: 'Operations' },
  { name: 'Party Management', id: 'party-management', href: '/party-management', icon: UserGroupIcon, section: 'Operations' },
  { name: 'Payment Vendor Approval', id: 'payment-vendor-approval', href: '/payment-vendor-approval', icon: DocumentTextIcon, section: 'Operations' },

  // Assets & Inventory Section
  { name: 'Stationary', id: 'stationary', href: '/inventory/stationary', icon: ClipboardDocumentListIcon, section: 'Inventory & Assets' },
  { name: 'Asset Management', id: 'asset-management', href: '/asset-management', icon: ComputerDesktopIcon, section: 'Inventory & Assets' },
  { name: 'Recharge', id: 'recharge', href: '/recharge', icon: CurrencyDollarIcon, section: 'Inventory & Assets' },

  // Communication Section
  { name: 'Chat', id: 'chat', href: '/chat', icon: ChatBubbleLeftRightIcon, section: 'Communication' },
];
