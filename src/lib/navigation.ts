// Main menu. Theme Step 1 (Oct 2026): every item has its OWN icon (before,
// several shared one — 5 boxes, 4 dollar signs, 2 phones — so they couldn't
// be told apart) and a plain-English name. The old short name stays in
// brackets where the team already knows it ("Orders (O2D)") so nobody gets
// lost. `id` and `href` are unchanged — page permissions keep working.
import {
  HomeIcon,
  PresentationChartBarIcon,
  TrophyIcon,
  RectangleGroupIcon,
  PaperAirplaneIcon,
  ClipboardDocumentCheckIcon,
  LifebuoyIcon,
  ClockIcon,
  UsersIcon,
  FingerPrintIcon,
  CalendarDaysIcon,
  BriefcaseIcon,
  IdentificationIcon,
  MegaphoneIcon,
  UserPlusIcon,
  UserMinusIcon,
  CurrencyRupeeIcon,
  FlagIcon,
  MapPinIcon,
  PhoneIcon,
  PhoneArrowUpRightIcon,
  ShoppingCartIcon,
  BuildingStorefrontIcon,
  DocumentPlusIcon,
  ArchiveBoxArrowDownIcon,
  InboxArrowDownIcon,
  ArrowPathRoundedSquareIcon,
  TruckIcon,
  CubeIcon,
  BookOpenIcon,
  BuildingOffice2Icon,
  BanknotesIcon,
  PencilSquareIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

export const navigation = [
  // Dashboard Section
  { name: 'Home', id: 'dashboard', href: '/', icon: HomeIcon, section: 'Dashboard' },
  { name: 'Reports (Metrix)', id: 'metrix', href: '/metrix', icon: PresentationChartBarIcon, section: 'Dashboard' },
  { name: 'Team Score', id: 'score', href: '/score', icon: TrophyIcon, section: 'Dashboard' },
  { name: 'EA-MD Hub', id: 'ea-md-hub', href: '/ea-md-hub', icon: RectangleGroupIcon, section: 'Dashboard' },

  // Task Section
  { name: 'Delegations', id: 'delegations', href: '/delegations', icon: PaperAirplaneIcon, section: 'Tasks' },
  { name: 'Checklists', id: 'checklists', href: '/checklists', icon: ClipboardDocumentCheckIcon, section: 'Tasks' },
  { name: 'Help Tickets', id: 'tickets', href: '/tickets', icon: LifebuoyIcon, section: 'Tasks' },
  { name: 'Scheduler', id: 'scheduler', href: '/scheduler', icon: ClockIcon, section: 'Tasks' },

  // HRMS Section
  { name: 'Users', id: 'users', href: '/users', icon: UsersIcon, section: 'Team & HR' },
  { name: 'Attendance', id: 'attendance', href: '/attendance', icon: FingerPrintIcon, section: 'Team & HR' },
  { name: 'Leave', id: 'leave', href: '/leave', icon: CalendarDaysIcon, section: 'Team & HR' },
  { name: 'Recruitment', id: 'hrms', href: '/hrms/recruitment', icon: BriefcaseIcon, section: 'Team & HR' },
  { name: 'Candidates', id: 'hrms', href: '/hrms/candidate', icon: IdentificationIcon, section: 'Team & HR' },
  { name: 'Sales Hiring', id: 'hrms', href: '/hrms/sales', icon: MegaphoneIcon, section: 'Team & HR' },
  { name: 'Onboarding', id: 'hrms', href: '/hrms/onboard', icon: UserPlusIcon, section: 'Team & HR' },
  { name: 'Offboarding', id: 'hrms', href: '/hrms/offboard', icon: UserMinusIcon, section: 'Team & HR' },

  // Sales & Field Section
  { name: 'Sales', id: 'sales', href: '/sales', icon: CurrencyRupeeIcon, section: 'Sales & Field' },
  { name: 'Customer Target', id: 'customer-target', href: '/customer-target', icon: FlagIcon, section: 'Sales & Field' },
  { name: 'Field Tracking', id: 'field-driver', href: '/field-driver', icon: MapPinIcon, section: 'Sales & Field' },
  { name: 'Customer Calls (Scot)', id: 'scot', href: '/scot', icon: PhoneIcon, section: 'Sales & Field' },
  { name: 'Customer Calls — Karol Bagh', id: 'scot-kb', href: '/scot-kb', icon: PhoneArrowUpRightIcon, section: 'Sales & Field' },

  // Operations Section
  { name: 'Orders (O2D)', id: 'o2d', href: '/o2d', icon: ShoppingCartIcon, section: 'Orders & Purchase' },
  { name: 'Orders — Karol Bagh', id: 'o2dkb', href: '/o2dkb', icon: BuildingStorefrontIcon, section: 'Orders & Purchase' },
  { name: 'Purchase Requests (I2R)', id: 'i2r', href: '/i2r', icon: DocumentPlusIcon, section: 'Orders & Purchase' },
  { name: 'Packing Requests', id: 'i2r-packing', href: '/i2r-packing', icon: ArchiveBoxArrowDownIcon, section: 'Orders & Purchase' },
  { name: 'Packing Received', id: 'item-receive-packing', href: '/item-receive-packing', icon: InboxArrowDownIcon, section: 'Orders & Purchase' },
  { name: 'Replacements', id: 'replace', href: '/replace', icon: ArrowPathRoundedSquareIcon, section: 'Orders & Purchase' },
  { name: 'Goods Received (GRN)', id: 'grn', href: '/grn', icon: TruckIcon, section: 'Orders & Purchase' },
  { name: 'Stock (IMS)', id: 'ims', href: '/ims', icon: CubeIcon, section: 'Orders & Purchase' },
  { name: 'Item Ledger', id: 'item-ledger', href: '/item-ledger', icon: BookOpenIcon, section: 'Orders & Purchase' },
  { name: 'Parties', id: 'party-management', href: '/party-management', icon: BuildingOffice2Icon, section: 'Orders & Purchase' },
  { name: 'Vendor Payment Approval', id: 'payment-vendor-approval', href: '/payment-vendor-approval', icon: BanknotesIcon, section: 'Orders & Purchase' },

  // Assets & Inventory Section
  { name: 'Stationery', id: 'stationary', href: '/inventory/stationary', icon: PencilSquareIcon, section: 'Office & Assets' },
  { name: 'Assets', id: 'asset-management', href: '/asset-management', icon: ComputerDesktopIcon, section: 'Office & Assets' },
  { name: 'Recharge', id: 'recharge', href: '/recharge', icon: DevicePhoneMobileIcon, section: 'Office & Assets' },

  // Communication Section
  { name: 'Chat', id: 'chat', href: '/chat', icon: ChatBubbleLeftRightIcon, section: 'Communication' },
];
