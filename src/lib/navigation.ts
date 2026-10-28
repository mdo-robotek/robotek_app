// Main menu. Theme Step 1 (Oct 2026): every item has its OWN icon — before,
// several shared one (5 boxes, 4 dollar signs, 2 phones), so they couldn't be
// told apart. Names stay exactly as the team already says them daily (O2D,
// I2R, GRN, IMS...) — Sahil asked for the familiar short forms, Oct 24.
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
  BoltIcon,
  UserGroupIcon as TeamBoardIcon,
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
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";

export const navigation = [
  // Dashboard Section
  { name: 'Home', id: 'dashboard', href: '/', icon: HomeIcon, section: 'Dashboard' },
  { name: 'Metrix', id: 'metrix', href: '/metrix', icon: PresentationChartBarIcon, section: 'Dashboard' },
  { name: 'Score', id: 'score', href: '/score', icon: TrophyIcon, section: 'Dashboard' },
  { name: 'Action Board', id: 'action-board', href: '/action-board', icon: BoltIcon, section: 'Dashboard' },
  { name: 'Performance Board', id: 'team-board', href: '/team-board', icon: TeamBoardIcon, section: 'Dashboard' },
  { name: 'EA-MD Hub', id: 'ea-md-hub', href: '/ea-md-hub', icon: RectangleGroupIcon, section: 'Dashboard' },

  // Task Section
  { name: 'Delegations', id: 'delegations', href: '/delegations', icon: PaperAirplaneIcon, section: 'Task' },
  { name: 'Checklists', id: 'checklists', href: '/checklists', icon: ClipboardDocumentCheckIcon, section: 'Task' },
  { name: 'Help Tickets', id: 'tickets', href: '/tickets', icon: LifebuoyIcon, section: 'Task' },
  { name: 'Scheduler', id: 'scheduler', href: '/scheduler', icon: ClockIcon, section: 'Task' },

  // HRMS Section
  { name: 'Users', id: 'users', href: '/users', icon: UsersIcon, section: 'HRMS' },
  { name: 'Attendance', id: 'attendance', href: '/attendance', icon: FingerPrintIcon, section: 'HRMS' },
  { name: 'Leave', id: 'leave', href: '/leave', icon: CalendarDaysIcon, section: 'HRMS' },
  { name: 'Recruitment', id: 'hrms', href: '/hrms/recruitment', icon: BriefcaseIcon, section: 'HRMS' },
  { name: 'Candidate', id: 'hrms', href: '/hrms/candidate', icon: IdentificationIcon, section: 'HRMS' },
  { name: 'Sales HR', id: 'hrms', href: '/hrms/sales', icon: MegaphoneIcon, section: 'HRMS' },
  { name: 'Onboard', id: 'hrms', href: '/hrms/onboard', icon: UserPlusIcon, section: 'HRMS' },
  { name: 'Offboard', id: 'hrms', href: '/hrms/offboard', icon: UserMinusIcon, section: 'HRMS' },

  // Sales & Field Section
  { name: 'Sales', id: 'sales', href: '/sales', icon: CurrencyRupeeIcon, section: 'Sales & Field' },
  { name: 'Customer Target', id: 'customer-target', href: '/customer-target', icon: FlagIcon, section: 'Sales & Field' },
  { name: 'Field Tracking', id: 'field-driver', href: '/field-driver', icon: MapPinIcon, section: 'Sales & Field' },
  { name: 'Scot', id: 'scot', href: '/scot', icon: PhoneIcon, section: 'Sales & Field' },
  { name: 'Scot KB', id: 'scot-kb', href: '/scot-kb', icon: PhoneArrowUpRightIcon, section: 'Sales & Field' },

  // Operations Section
  { name: 'O2D', id: 'o2d', href: '/o2d', icon: ShoppingCartIcon, section: 'Operations' },
  { name: 'O2D KB', id: 'o2dkb', href: '/o2dkb', icon: BuildingStorefrontIcon, section: 'Operations' },
  { name: 'New Launch FMS', id: 'new-launch', href: '/new-launch', icon: RocketLaunchIcon, section: 'Operations' },
  { name: 'I2R', id: 'i2r', href: '/i2r', icon: DocumentPlusIcon, section: 'Operations' },
  { name: 'I2R Packing', id: 'i2r-packing', href: '/i2r-packing', icon: ArchiveBoxArrowDownIcon, section: 'Operations' },
  { name: 'Item Receive (PACKING)', id: 'item-receive-packing', href: '/item-receive-packing', icon: InboxArrowDownIcon, section: 'Operations' },
  { name: 'Replace', id: 'replace', href: '/replace', icon: ArrowPathRoundedSquareIcon, section: 'Operations' },
  { name: 'GRN', id: 'grn', href: '/grn', icon: TruckIcon, section: 'Operations' },
  { name: 'IMS', id: 'ims', href: '/ims', icon: CubeIcon, section: 'Operations' },
  { name: 'Item Ledger', id: 'item-ledger', href: '/item-ledger', icon: BookOpenIcon, section: 'Operations' },
  { name: 'Party Management', id: 'party-management', href: '/party-management', icon: BuildingOffice2Icon, section: 'Operations' },
  { name: 'Payment Vendor Approval', id: 'payment-vendor-approval', href: '/payment-vendor-approval', icon: BanknotesIcon, section: 'Operations' },

  // Assets & Inventory Section
  { name: 'Stationary', id: 'stationary', href: '/inventory/stationary', icon: PencilSquareIcon, section: 'Inventory & Assets' },
  { name: 'Asset Management', id: 'asset-management', href: '/asset-management', icon: ComputerDesktopIcon, section: 'Inventory & Assets' },
  { name: 'Recharge', id: 'recharge', href: '/recharge', icon: DevicePhoneMobileIcon, section: 'Inventory & Assets' },

  // Communication Section
  { name: 'Chat', id: 'chat', href: '/chat', icon: ChatBubbleLeftRightIcon, section: 'Communication' },
];
