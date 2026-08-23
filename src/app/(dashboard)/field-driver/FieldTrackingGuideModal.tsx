"use client";

import { useState } from "react";
import {
  XMarkIcon,
  MapPinIcon,
  CameraIcon,
  ArrowPathIcon,
  MapIcon,
  TableCellsIcon,
  DocumentChartBarIcon,
  UserIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ServerStackIcon,
  KeyIcon,
  CircleStackIcon,
} from "@heroicons/react/24/outline";

interface FieldTrackingGuideModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

function Section({
  id,
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50/80 dark:bg-slate-900/50 hover:bg-gray-100/80 dark:hover:bg-slate-800/50 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">
          {Icon && <Icon className="w-4 h-4 text-[#003875] dark:text-[#FFD500]" />}
          {title}
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-xs leading-relaxed">
      <span className="font-black uppercase tracking-wider text-[#003875] dark:text-[#FFD500]">{label}: </span>
      <span className="text-gray-600 dark:text-gray-300">{value}</span>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 list-disc pl-4 leading-relaxed">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ColTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-gray-50 dark:bg-slate-800/80">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-black uppercase tracking-wider text-gray-500 border-b border-gray-100 dark:border-white/10">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 dark:border-white/5 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-600 dark:text-gray-300 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FieldTrackingGuideModal({ open, onClose, isAdmin }: FieldTrackingGuideModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-3 md:p-6 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-tracking-guide-title"
        className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto custom-scrollbar rounded-[24px] border border-white/20 shadow-2xl"
        style={{ backgroundColor: "var(--panel-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-5 md:p-6 pb-4 border-b border-gray-100 dark:border-white/10 bg-[var(--panel-card)]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#003875] dark:text-[#FFD500] mb-1">
              Complete reference
            </p>
            <h2 id="field-tracking-guide-title" className="text-xl font-black uppercase text-gray-900 dark:text-white tracking-tight">
              Field Tracking — Full System Guide
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
              Login logic · Maps · Data storage · Every tab · APIs · Verification rules
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            aria-label="Close guide"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-4">
          {/* Quick nav */}
          <div className="flex flex-wrap gap-2 pb-2">
            {[
              ["login", "Login"],
              ["tech", "Tech Stack"],
              ["storage", "Storage"],
              ["apis", "APIs"],
              ["tab-tracking", "My Tracking"],
              ...(isAdmin ? [["tab-map", "Admin Map"], ["tab-logs", "Admin Logs"], ["tab-report", "Admin Report"]] : []),
              ["status", "Status Logic"],
              ["verify", "Verification"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#003875]/10 dark:bg-[#FFD500]/10 text-[#003875] dark:text-[#FFD500] hover:opacity-80"
              >
                {label}
              </a>
            ))}
          </div>

          {/* ── LOGIN & ACCESS ── */}
          <Section id="login" title="Login & Access Control" icon={KeyIcon}>
            <BulletList
              items={[
                "You must be logged in to Robotek via NextAuth. On page load, the app calls GET /api/auth/session and reads session.user (id, username, name, email, role, image).",
                "If no session → page shows “Unauthorized. Please log in.”",
                "AccessGuard allows /field-driver for all authenticated users — no extra module permission is required for this page.",
                "Role check: user.role.toLowerCase() === 'admin' unlocks the 4-tab pill navigation (My Tracking, Admin Map, Admin Logs, Admin Report).",
                "Non-admin users only see the My Tracking tab — they cannot open admin map, logs, or report views.",
                "Your userId from the session is used for all API calls (check-in, live sync, status fetch). userName is stored in sheets as the display name.",
              ]}
            />
            <Detail label="Status fetch on load" value="GET /api/field-driver?userId={id} → returns currentStatus (IDLE | CHECKED_IN | COMPLETED), lastCheckIn, odometerIn, todayRecord, and full history." />
          </Section>

          {/* ── TECH STACK ── */}
          <Section id="tech" title="Technologies & Services Used" icon={ServerStackIcon}>
            <ColTable
              headers={["Layer", "Technology", "Details"]}
              rows={[
                ["Map engine", "Leaflet + react-leaflet", "Interactive map rendered client-side. Dynamically imported (ssr: false) so it does not break Next.js server rendering."],
                ["Map tiles", "CARTO Voyager (OSM)", "URL: basemaps.cartocdn.com/rastertiles/voyager. OpenStreetMap data via CARTO CDN. Default center: New Delhi (28.6139, 77.2090) when no data."],
                ["Route drawing", "Leaflet Polyline", "GPS pings connected as colored lines. Last ping shown with custom scooter marker + name label."],
                ["Live GPS (field staff)", "Browser Geolocation API", "navigator.geolocation.watchPosition with enableHighAccuracy: true, timeout 15s, maximumAge 10s. Runs continuously on the page."],
                ["Address lookup", "OpenStreetMap Nominatim", "Reverse geocode: nominatim.openstreetmap.org/reverse?lat=&lon= — debounced 1.5s after GPS update."],
                ["Camera", "MediaDevices API", "navigator.mediaDevices.getUserMedia — rear camera (environment) by default, flip to front (user). Photo captured to canvas as JPEG base64."],
                ["Backend", "Next.js App Router API Routes", "Server-side routes under /api/field-driver/* with force-dynamic (no cache)."],
                ["Database", "Google Sheets API", "OAuth2 service account tokens from GOOGLE_OAUTH_TOKENS env. Reads/writes spreadsheet tabs."],
                ["Photo storage", "Google Drive API", "Base64 dashboard photos uploaded to Drive folder. File ID stored in sheet. Public read permission set on upload."],
                ["Timezone", "IST (UTC+5:30)", "All “today” date logic uses IST offset: new Date(now + 5.5h).toISOString().split('T')[0]."],
              ]}
            />
          </Section>

          {/* ── DATA STORAGE ── */}
          <Section id="storage" title="How Data Is Saved" icon={CircleStackIcon}>
            <Detail label="Google Spreadsheet" value="Single spreadsheet (ID configured in field-driver-sheets.ts). Two tabs:" />

            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mt-2">Tab 1 — “Field Driver” (check-in / check-out records)</p>
            <ColTable
              headers={["Column", "Field", "Saved when"]}
              rows={[
                ["A", "id", "Auto: FD-{timestamp} on check-in"],
                ["B", "userId", "Session user ID"],
                ["C", "userName", "Session username"],
                ["D", "date", "IST date YYYY-MM-DD"],
                ["E", "inTime", "ISO timestamp on check-in"],
                ["F", "outTime", "ISO timestamp on check-out (empty until checkout)"],
                ["G", "status", "IN → COMPLETED on checkout"],
                ["H", "inLocation", "Reverse-geocoded address OR lat,lng"],
                ["I", "outLocation", "Same format on checkout"],
                ["J", "odometerIn", "Odometer reading at check-in"],
                ["K", "odometerOut", "Odometer reading at check-out"],
                ["L", "odometerPhotoIn", "Google Drive file ID (IN photo)"],
                ["M", "odometerPhotoOut", "Google Drive file ID (OUT photo)"],
                ["N", "totalKm", "odometerOut − odometerIn (calculated on checkout)"],
              ]}
            />

            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mt-3">Tab 2 — “Live Tracking” (GPS route pings)</p>
            <ColTable
              headers={["Column", "Field", "Saved when"]}
              rows={[
                ["A", "userId", "Field staff user ID"],
                ["B", "userName", "Display name"],
                ["C", "date", "IST date YYYY-MM-DD"],
                ["D", "pathData", "JSON array appended every ping: [{ time, lat, lng }, ...] — one row per user per day"],
              ]}
            />

            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mt-3">Google Drive — Odometer photos</p>
            <BulletList
              items={[
                "Photos captured as base64 JPEG on the client.",
                "POST /api/field-driver uploads via uploadBase64ToDrive() to folder ID 1SQMqapbD4fFCdNGC8QKeJwmyg-toUSFF.",
                "Returns Google Drive file ID → stored in sheet columns L or M.",
                "File named attendance-{timestamp}.jpeg with “anyone with link can view” permission.",
              ]}
            />
          </Section>

          {/* ── APIs ── */}
          <Section id="apis" title="API Endpoints" icon={ServerStackIcon} defaultOpen={false}>
            <ColTable
              headers={["Method & Route", "Purpose", "Key params / body"]}
              rows={[
                ["GET /api/field-driver?userId=", "Get user status & history", "Returns currentStatus, lastCheckIn, odometerIn, todayRecord, history[]"],
                ["POST /api/field-driver", "Check-in or check-out", "Body: { action: CHECK_IN|CHECK_OUT, userId, userName, latitude, longitude, address, odometer, photo }"],
                ["POST /api/field-driver/live", "Append GPS ping", "Body: { userId, userName, lat, lng } — only called while CHECKED_IN, every 60s"],
                ["GET /api/field-driver/live?date=", "Get all routes for a date", "Returns { records: [{ userId, userName, date, pathData }] }"],
                ["GET /api/field-driver/all", "Admin: all attendance + live data", "Optional ?date=YYYY-MM-DD filter. Returns { attendance[], liveTracking[] }"],
              ]}
            />
          </Section>

          {/* ── TAB: MY TRACKING ── */}
          <Section id="tab-tracking" title="Tab 1 — My Tracking (All Users)" icon={UserIcon}>
            <p className="text-xs text-gray-500 dark:text-gray-400">Two side-by-side panels. Default tab for every logged-in user.</p>

            <p className="text-[11px] font-black uppercase tracking-wider text-[#003875] dark:text-[#FFD500]">Left panel — Journey Status</p>
            <BulletList
              items={[
                "Shows one of three states: IDLE (can check in), CHECKED_IN (timer running, can end journey), COMPLETED (journey done for today).",
                "Live elapsed timer (HH:MM:SS) counts from check-in time, updates every 1 second.",
                "Yellow pulse bar at top when CHECKED_IN is active.",
                "Start Field Check-in button — disabled until GPS coordinates are available.",
                "Check-in form: odometer number input + camera capture (Open Camera → capture → retake). Submit sends POST CHECK_IN.",
                "End Journey button opens check-out form (same fields). Shows starting odometer as reference.",
                "After successful checkout → success toast with total KM. Status becomes COMPLETED until next IST day.",
              ]}
            />

            <p className="text-[11px] font-black uppercase tracking-wider text-[#003875] dark:text-[#FFD500] mt-2">Right panel — GPS Signal Status</p>
            <BulletList
              items={[
                "Shows GPS acquisition spinner until coordinates arrive.",
                "When locked: latitude & longitude (6 decimal places), reverse-geocoded address below.",
                "Red “Locked In” badge with animated pin icon.",
                "If location denied: red error box with message (e.g. “Location access denied. Please enable Location Services.”).",
                "When CHECKED_IN: shows “Live syncing active” with spinning icon — confirms 60-second background sync is running.",
                "GPS watch runs whenever page is open (even before check-in) so location is ready for check-in.",
              ]}
            />

            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mt-2">Background sync logic (while CHECKED_IN)</p>
            <BulletList
              items={[
                "Every 60 seconds (+ immediately on check-in): POST /api/field-driver/live with current lat/lng.",
                "Server appends { time, lat, lng } to pathData JSON in Live Tracking sheet.",
                "Requires tab to stay open in browser for continuous pings.",
              ]}
            />
          </Section>

          {/* ── TAB: ADMIN MAP ── */}
          {isAdmin && (
            <Section id="tab-map" title="Tab 2 — Admin Map (Admin Only)" icon={MapIcon}>
              <BulletList
                items={[
                  "Full-height map view with left sidebar + map area.",
                  "Data source: GET /api/field-driver/live?date={selectedDate} — refreshes automatically every 60 seconds.",
                  "Date picker at top of sidebar (defaults to today in IST via getIstDateString()).",
                  "Sidebar lists every user who has GPS pings on that date — shows name + ping count.",
                  "Click a user to isolate their route; click again to show all users.",
                  "Each user gets a unique route color (#FFD500, #003875, #EF4444, #10B981, #F59E0B, #8B5CF6).",
                  "Map draws: Polyline connecting all pings, scooter emoji marker at last ping with name label, dot markers on each ping when user is selected.",
                  "Map auto-centers on first user's last ping if data exists; otherwise New Delhi.",
                  "Empty state: “No field movement recorded today.” when no pings for selected date.",
                  "Loading indicator: “Syncing…” badge top-right while fetching.",
                ]}
              />
            </Section>
          )}

          {/* ── TAB: ADMIN LOGS ── */}
          {isAdmin && (
            <Section id="tab-logs" title="Tab 3 — Admin Logs (Admin Only)" icon={TableCellsIcon}>
              <BulletList
                items={[
                  "Title: “Attendance & Verification Logs”. Cross-references odometer vs GPS.",
                  "Data source: GET /api/field-driver/all?date={filterDate} — date filter optional (empty = all dates).",
                  "15 records per page with prev/next pagination.",
                  "Table columns: Driver (name + ID), Date, Timeline (in/out times + locations), Odometer Proof (IN/OUT photo buttons), Odometer KM, GPS KM, Status badge.",
                  "GPS KM calculated client-side using Haversine formula — sum of distances between consecutive pings in pathData.",
                  "Click IN or OUT photo button → full-screen photo modal overlay.",
                  "Odometer KM only shown when status = COMPLETED; shows “--” if still active.",
                ]}
              />
            </Section>
          )}

          {/* ── TAB: ADMIN REPORT ── */}
          {isAdmin && (
            <Section id="tab-report" title="Tab 4 — Admin Report (Admin Only)" icon={DocumentChartBarIcon}>
              <BulletList
                items={[
                  "Title: “Monthly Field Report”. Grid/matrix view of all field drivers.",
                  "Data source: GET /api/field-driver/all (all records, filtered by month on client).",
                  "Month picker with prev/next arrows. Sticky driver name column + day columns 1–31.",
                  "Cell values: IN {time} / OUT {time} (green bg) if checked in that day.",
                  "“A” (Absent, red) — past weekday with no check-in record.",
                  "“S” / SUN — Sundays highlighted in red.",
                  "“-” — future days or no data yet.",
                  "Today column highlighted with navy/gold border.",
                  "Export CSV button → downloads Field_Driver_Report_{Month Year}.csv with driver name, ID, and daily cells.",
                  "CSV logic: SUN for Sundays, IN/OUT times if record exists, A for past absent days, - otherwise.",
                ]}
              />
            </Section>
          )}

          {/* ── STATUS LOGIC ── */}
          <Section id="status" title="Status Logic (Server-Side)" icon={CheckCircleIcon} defaultOpen={false}>
            <ColTable
              headers={["Status", "Condition", "What user sees"]}
              rows={[
                ["IDLE", "No record for today (IST), OR record exists but no inTime", "“Standby Mode” + Start Field Check-in button"],
                ["CHECKED_IN", "Today's record has inTime but no outTime (status IN)", "Timer running + End Journey button + live sync active"],
                ["COMPLETED", "Today's record has outTime (status COMPLETED)", "“Journey Completed” green badge — no more actions today"],
              ]}
            />
            <Detail label="Check-in creates" value="New row with id FD-{timestamp}, status IN, all IN fields filled, OUT fields empty." />
            <Detail label="Check-out updates" value="Finds today's IN record for userId → sets outTime, outLocation, odometerOut, photoOut, totalKm, status COMPLETED." />
            <Detail label="totalKm formula" value="Math.max(0, odometerOut − odometerIn). Empty if odometer values are invalid/non-numeric." />
          </Section>

          {/* ── VERIFICATION ── */}
          <Section id="verify" title="GPS vs Odometer Verification (Admin Logs)" icon={CheckCircleIcon} defaultOpen={false}>
            <ColTable
              headers={["Badge", "Rule", "Meaning"]}
              rows={[
                ["Active Now (blue)", "Checkout not done yet", "Trip still in progress — verification pending"],
                ["Verified (green)", "|odometerKm − gpsKm| / odometerKm ≤ 25%", "GPS route matches odometer reading"],
                ["GPS Drop (orange)", "GPS KM significantly lower than odometer", "Possible lost signal, tunnels, or GPS disabled mid-trip"],
                ["Review ODO (red)", "GPS KM > odometer KM", "Suspicious — GPS travelled further than odometer suggests"],
                ["0 KM (gray)", "Both odometer and GPS are 0 after checkout", "No movement recorded"],
              ]}
            />
            <Detail label="Haversine formula" value="Earth radius 6371 km. Sums distance between each consecutive ping pair in pathData JSON array." />
          </Section>

          {/* ── REQUIREMENTS & TIPS ── */}
          <Section id="tips" title="Requirements, Permissions & Tips" defaultOpen={false}>
            <BulletList
              items={[
                "Browser must allow Location Services (required for check-in, check-out, and live sync).",
                "Browser must allow Camera access (required for odometer dashboard photos).",
                "HTTPS required for geolocation and camera on most browsers.",
                "Keep the Field Tracking browser tab open during the entire trip for 60-second GPS pings.",
                "Use rear/environment camera for clearer odometer photos; flip button switches front/rear.",
                "Check-in and check-out both blocked if GPS is unavailable at submit time.",
                "One journey per IST calendar day per user — cannot check in again after completing checkout.",
                "Admin tabs only visible when logged-in role is Admin (case-insensitive check).",
              ]}
            />
          </Section>
        </div>

        <div className="sticky bottom-0 p-4 border-t border-gray-100 dark:border-white/10 bg-[var(--panel-card)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-[#003875] dark:bg-[#FFD500] text-white dark:text-black text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
