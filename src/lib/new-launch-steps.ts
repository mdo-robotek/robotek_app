// New Launch FMS (Sahil, 2026-10-26) — the 42-step flow from
// "New Launch FMS Flowchart": Google-form style entry → vendor & sample →
// packaging → creatives → pricing → LAUNCH → post-launch marketing.
// Shared by the API (state machine) and the page (labels, filters).
//
// Approval steps: MD / Admin approves → next step; rejects → flow goes back
// to `reworkStep` (the design step) and comes back for approval again.

export type NewLaunchFieldType = "text" | "number" | "date" | "url";

export interface NewLaunchField {
  key: string;
  label: string;
  type: NewLaunchFieldType;
  required?: boolean;
}

export interface NewLaunchStep {
  n: number;
  name: string;
  detail?: string;
  doer: string;
  tatDays: number;
  phase: string;
  approval?: { by: "MD" | "Admin"; reworkStep: number };
  /** Step 22 — planned date is the Launch Date fixed at step 20, not a TAT. */
  launch?: boolean;
  fields?: NewLaunchField[];
}

const DESIGN_LINK: NewLaunchField = { key: "link", label: "Design / file link", type: "url" };

export const NEW_LAUNCH_STEPS: NewLaunchStep[] = [
  { n: 1, name: "Final Vendor", doer: "Himanshi", tatDays: 5, phase: "Sourcing",
    fields: [{ key: "vendor_name", label: "Final vendor name", type: "text", required: true }] },
  { n: 2, name: "Final Physical Sample", doer: "Purchase Head", tatDays: 10, phase: "Sourcing" },
  { n: 3, name: "PO Issue", doer: "Purchase Head", tatDays: 1, phase: "Sourcing",
    fields: [{ key: "po_number", label: "PO number", type: "text", required: true }] },
  { n: 4, name: "Picture, Specs, KLD, 3D Image to Design Team", detail: "Verified by Sahil Sir", doer: "Purchase Head", tatDays: 7, phase: "Sourcing",
    fields: [{ key: "link", label: "Files link (pictures / specs / KLD / 3D)", type: "url" }] },

  { n: 5, name: "Assign Designer — Packaging Design", doer: "EA", tatDays: 1, phase: "Packaging",
    fields: [{ key: "designer", label: "Designer assigned", type: "text", required: true }] },
  { n: 6, name: "Design Packaging", doer: "Designer Team", tatDays: 1, phase: "Packaging", fields: [DESIGN_LINK] },
  { n: 7, name: "Packaging Design Approval", doer: "MD", tatDays: 1, phase: "Packaging", approval: { by: "MD", reworkStep: 6 } },
  { n: 8, name: "Packaging -1/10/Master PO Issue", doer: "Purchase Head", tatDays: 1, phase: "Packaging",
    fields: [{ key: "packaging_po_number", label: "Packaging PO number", type: "text", required: true }] },

  { n: 9, name: "Assign Designer — Creative", doer: "EA", tatDays: 1, phase: "Creative",
    fields: [{ key: "designer", label: "Designer assigned", type: "text", required: true }] },
  { n: 10, name: "Design Creative", doer: "Designer Team", tatDays: 1, phase: "Creative", fields: [DESIGN_LINK] },
  { n: 11, name: "Creative Approval", doer: "MD", tatDays: 1, phase: "Creative", approval: { by: "MD", reworkStep: 10 } },

  { n: 12, name: "Assign Designer — Coming Soon Video", doer: "EA", tatDays: 1, phase: "Coming Soon",
    fields: [{ key: "designer", label: "Designer assigned", type: "text", required: true }] },
  { n: 13, name: "Product Coming Soon Video", doer: "Designer Team", tatDays: 1, phase: "Coming Soon", fields: [DESIGN_LINK] },
  { n: 14, name: "Coming Soon Video Approval", doer: "Admin", tatDays: 1, phase: "Coming Soon", approval: { by: "Admin", reworkStep: 13 } },

  { n: 15, name: "Assign Designer — Launch Scheme", doer: "EA", tatDays: 1, phase: "Launch Scheme",
    fields: [{ key: "designer", label: "Designer assigned", type: "text", required: true }] },
  { n: 16, name: "Design Launch Scheme", detail: "Discuss with Sales Team, confirm from Sahil Sir", doer: "Designer Team", tatDays: 1, phase: "Launch Scheme", fields: [DESIGN_LINK] },
  { n: 17, name: "Launch Scheme Approval", doer: "Admin", tatDays: 1, phase: "Launch Scheme", approval: { by: "Admin", reworkStep: 16 } },

  { n: 18, name: "Share Cost to Sahil Sir", doer: "Purchase Head", tatDays: 1, phase: "Pricing & Launch",
    fields: [{ key: "cost", label: "Landed cost (₹)", type: "number", required: true }] },
  { n: 19, name: "GST Price & SS Price Final", detail: "From Sahil Sir", doer: "EA", tatDays: 7, phase: "Pricing & Launch",
    fields: [
      { key: "gst_price", label: "GST price (₹)", type: "number", required: true },
      { key: "ss_price", label: "SS price (₹)", type: "number", required: true },
    ] },
  { n: 20, name: "Launch Date Final", detail: "Confirmation from Himanshi Mam", doer: "EA", tatDays: 3, phase: "Pricing & Launch",
    fields: [{ key: "launch_date", label: "Launch date", type: "date", required: true }] },
  { n: 21, name: "Inform Customers (GTK+KB) & All Team Members", doer: "EA", tatDays: 1, phase: "Pricing & Launch" },
  { n: 22, name: "LAUNCH THE PRODUCT", detail: "As per Launch Date", doer: "EA", tatDays: 0, phase: "Pricing & Launch", launch: true },

  { n: 23, name: "Assign Designer — How to Use Video", doer: "EA", tatDays: 1, phase: "How to Use Video",
    fields: [{ key: "designer", label: "Designer assigned", type: "text", required: true }] },
  { n: 24, name: "How to Use Video — Upload on YouTube", doer: "Designer Team", tatDays: 1, phase: "How to Use Video",
    fields: [{ key: "youtube_link", label: "YouTube link", type: "url", required: true }] },
  { n: 25, name: "How to Use Video Approval", doer: "Admin", tatDays: 1, phase: "How to Use Video", approval: { by: "Admin", reworkStep: 24 } },

  { n: 26, name: "Update Catalogue", doer: "Nitin Gaur", tatDays: 1, phase: "Catalogue & Sales" },
  { n: 27, name: "Update Website", doer: "Nitin Gaur", tatDays: 1, phase: "Catalogue & Sales",
    fields: [{ key: "link", label: "Website product link", type: "url" }] },
  { n: 28, name: "Update Price List", doer: "Nitin Gaur", tatDays: 1, phase: "Catalogue & Sales" },
  { n: 29, name: "Update Order Book", doer: "Vishal Sharma", tatDays: 1, phase: "Catalogue & Sales" },
  { n: 30, name: "Call Parties & Take Orders — GTK", doer: "SC CRR GTK", tatDays: 1, phase: "Catalogue & Sales",
    fields: [{ key: "orders_gtk", label: "Orders taken (qty)", type: "number" }] },
  { n: 31, name: "Call Parties & Take Orders — KB", doer: "SC CRR KB", tatDays: 1, phase: "Catalogue & Sales",
    fields: [{ key: "orders_kb", label: "Orders taken (qty)", type: "number" }] },
  { n: 32, name: "Post Creative & Video", detail: "Groups, Community, WhatsApp Channel & Broadcast", doer: "EA", tatDays: 1, phase: "Catalogue & Sales" },

  { n: 33, name: "Assign Designer — Social Media Post", doer: "EA", tatDays: 1, phase: "Social Media",
    fields: [{ key: "designer", label: "Designer assigned", type: "text", required: true }] },
  { n: 34, name: "Design Social Media Post + Video", doer: "Designer Team", tatDays: 1, phase: "Social Media", fields: [DESIGN_LINK] },
  { n: 35, name: "Social Media Post Approval", doer: "Admin", tatDays: 1, phase: "Social Media", approval: { by: "Admin", reworkStep: 34 } },
  { n: 36, name: "Post on Insta, Facebook, LinkedIn", doer: "Digital Marketer", tatDays: 1, phase: "Social Media",
    fields: [{ key: "link", label: "Post link", type: "url" }] },

  { n: 37, name: "Assign Designer — Drip Marketing Creative", doer: "EA", tatDays: 1, phase: "Drip Marketing",
    fields: [{ key: "designer", label: "Designer assigned", type: "text", required: true }] },
  { n: 38, name: "Design Drip Marketing Creative", doer: "EA", tatDays: 1, phase: "Drip Marketing", fields: [DESIGN_LINK] },
  { n: 39, name: "Drip Marketing Approval", doer: "Admin", tatDays: 1, phase: "Drip Marketing", approval: { by: "Admin", reworkStep: 38 } },
  { n: 40, name: "Drip Marketing — Sales Funnel & Potential Leads", doer: "EA", tatDays: 1, phase: "Drip Marketing" },
  { n: 41, name: "All Team Status Update", detail: "Mobile Group", doer: "EA", tatDays: 1, phase: "Drip Marketing" },
  { n: 42, name: "YouTube Link Share to All", detail: "How to Use + Benefits (WhatsApp Broadcast)", doer: "EA", tatDays: 1, phase: "Drip Marketing" },
];

export const NEW_LAUNCH_TOTAL_STEPS = NEW_LAUNCH_STEPS.length;
export const NEW_LAUNCH_LAUNCH_STEP = 22;

export const NEW_LAUNCH_PHASES = Array.from(new Set(NEW_LAUNCH_STEPS.map((s) => s.phase)));

export function getNewLaunchStep(n: number): NewLaunchStep | undefined {
  return NEW_LAUNCH_STEPS[n - 1];
}

/** Admin-editable doer / TAT override for one step (Config tab). */
export interface NewLaunchStepConfig {
  step: number;
  doer: string;
  tat_days: number;
}

export function mergeStepConfig(configs: NewLaunchStepConfig[]): NewLaunchStep[] {
  const byStep = new Map(configs.map((c) => [Number(c.step), c]));
  return NEW_LAUNCH_STEPS.map((s) => {
    const c = byStep.get(s.n);
    if (!c) return s;
    return {
      ...s,
      doer: String(c.doer || "").trim() || s.doer,
      tatDays: Number.isFinite(Number(c.tat_days)) && String(c.tat_days).trim() !== "" ? Number(c.tat_days) : s.tatDays,
    };
  });
}
