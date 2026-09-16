import { IMSMasterItem } from "@/types/ims-master";

export function masterItemKey(name: string | undefined | null): string {
  return (name || "").trim().toLowerCase();
}

export function normalizeActiveStatus(value: string | undefined | null): string {
  const n = (value || "").trim().toLowerCase();
  if (n === "active") return "Active";
  if (n === "inactive") return "Inactive";
  return (value || "").trim();
}

export function indexMasterByName(rows: IMSMasterItem[]): Map<string, IMSMasterItem> {
  const map = new Map<string, IMSMasterItem>();
  rows.forEach((row) => {
    const key = masterItemKey(row.item_name);
    if (key) map.set(key, row);
  });
  return map;
}

export type MasterOverlayFields = {
  sku_code: string;
  active_status: string;
  category: string;
  lead_time: number;
  safety_factor: number;
  in_master: boolean;
};

export function overlayFromMaster<T extends { item_name?: string; category?: string }>(
  item: T,
  master: IMSMasterItem | undefined,
  defaults: { lead_time?: number; safety_factor?: number } = {}
): T & MasterOverlayFields {
  const defaultLead = defaults.lead_time ?? 30;
  const defaultSf = defaults.safety_factor ?? 1;
  if (!master) {
    return {
      ...item,
      sku_code: "",
      active_status: "",
      category: (item.category || "").trim(),
      lead_time: defaultLead,
      safety_factor: defaultSf,
      in_master: false,
    };
  }

  const lead = parseFloat(master.lead_time);
  const sf = parseFloat(master.safety_factor);
  return {
    ...item,
    sku_code: master.sku_code || "",
    active_status: master.active_status || "",
    category: master.category || (item.category || "").trim(),
    lead_time: !isNaN(lead) && lead > 0 ? lead : defaultLead,
    safety_factor: !isNaN(sf) && sf > 0 ? sf : defaultSf,
    in_master: true,
  };
}
