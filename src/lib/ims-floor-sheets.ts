import { BaseSheetsService } from "./sheets/base-service";
import { FloorIMS } from "@/types/ims-floor";

const SPREADSHEET_ID = "12lk8GV7ZBpm6J-bA5TBWfHQ1qY0eEHIrwOICSnsuceE";

class FloorIMSService extends BaseSheetsService<FloorIMS> {
  protected spreadsheetId = SPREADSHEET_ID;
  protected sheetName: string;
  protected range = "A:Z";
  protected idColumnIndex = 0;

  constructor(sheetName: string) {
    super();
    this.sheetName = sheetName;
  }

  mapRowToItem(row: any[]): FloorIMS {
    const get = (h: string, fallbackIdx: number) => {
      const idx = this.hMap[h.toLowerCase()];
      return (idx !== undefined ? row[idx] : row[fallbackIdx]) || "";
    };
    return {
      id: get("id", 0),
      item_name: get("item name", 1),
      category: get("category", 2),
      in_qty: get("in qty", 3),
      out_qty: get("out qty", 4),
      date: get("date", 5),
      packed_status: get("packed status", -1), // dynamic based on header
      checked_status: get("checked status", -1),
      updated_at: get("updated_at", 6),
    };
  }

  mapItemToRow(ims: FloorIMS): any[] {
    const row: any[] = [];
    const set = (h: string, fallbackIdx: number, val: any) => {
      const idx = this.hMap[h.toLowerCase()];
      row[idx !== undefined ? idx : fallbackIdx] = val ?? "";
    };

    set("id", 0, String(ims.id));
    set("item name", 1, ims.item_name);
    set("category", 2, ims.category);
    set("in qty", 3, ims.in_qty);
    set("out qty", 4, ims.out_qty);
    set("date", 5, ims.date);
    
    // Only set if we know where it goes, otherwise rely on header map
    if (this.hMap["packed status"] !== undefined) {
      set("packed status", -1, ims.packed_status || "");
    }

    if (this.hMap["checked status"] !== undefined) {
      set("checked status", -1, ims.checked_status || "");
    }
    
    // If updated_at is mapped dynamically, use that, else assume index 6 (which might shift if packed status is inserted before it, but hMap solves this)
    set("updated_at", this.hMap["updated_at"] !== undefined ? this.hMap["updated_at"] : (this.hMap["packed status"] !== undefined ? 7 : 6), ims.updated_at);

    return row;
  }

  async getNextNumericalId(): Promise<number> {
    const ids = await this.getLatestIds();
    const numericIds = ids.map((id) => parseInt(String(id)) || 0);
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  }
}

export const ims1stFloorService = new FloorIMSService("IMS-1st Floor");
export const imsGFloorService = new FloorIMSService("IMS-G Floor");

let locks: Record<string, Promise<any>> = {
  "1st": Promise.resolve(),
  "g": Promise.resolve()
};

function getService(location: string) {
  if (location === "1st") return ims1stFloorService;
  if (location === "g") return imsGFloorService;
  throw new Error("Invalid location");
}

export async function getFloorIMSItems(location: string): Promise<FloorIMS[]> {
  const service = getService(location);
  const items = await service.getAll();
  return items.map(item => {
    const inQty = parseFloat(item.in_qty) || 0;
    const outQty = parseFloat(item.out_qty) || 0;
    return { ...item, live_stock: inQty - outQty };
  });
}

export async function addFloorIMSItem(location: string, data: Partial<FloorIMS>): Promise<boolean> {
  const service = getService(location);
  return (locks[location] = locks[location]
    .then(async () => {
      if (!data.id) {
        data.id = (await service.getNextNumericalId()).toString();
      }
      return service.add(data as FloorIMS);
    })
    .catch((err) => {
      console.error(`Error in addFloorIMSItem lock (${location}):`, err);
      return false;
    }));
}

export async function addFloorIMSItems(
  location: string,
  dataList: Partial<FloorIMS>[]
): Promise<{ success: boolean; added: number }> {
  const service = getService(location);
  return (locks[location] = locks[location]
    .then(async () => {
      if (dataList.length === 0) return { success: true, added: 0 };

      let nextId = await service.getNextNumericalId();
      const now = new Date().toISOString();
      const items: FloorIMS[] = dataList.map((data) => {
        const id = data.id || String(nextId++);
        return {
          id,
          item_name: data.item_name || "",
          category: data.category || "",
          in_qty: data.in_qty ?? "0",
          out_qty: data.out_qty ?? "0",
          date: data.date || "",
          packed_status: data.packed_status,
          checked_status: data.checked_status,
          updated_at: data.updated_at || now,
        } as FloorIMS;
      });

      const ok = await service.addMany(items);
      return { success: ok, added: ok ? items.length : 0 };
    })
    .catch((err) => {
      console.error(`Error in addFloorIMSItems lock (${location}):`, err);
      return { success: false, added: 0 };
    })) as Promise<{ success: boolean; added: number }>;
}

export async function updateFloorIMSItem(location: string, id: string, data: FloorIMS): Promise<boolean> {
  const service = getService(location);
  const ok = await service.update(id, data);
  // Bust cache so Date-Wise / summary reads see the new qty immediately
  service.invalidateCache();
  return ok;
}

export async function deleteFloorIMSItem(location: string, id: string): Promise<boolean> {
  const service = getService(location);
  const ok = await service.delete(id);
  service.invalidateCache();
  return ok;
}

export async function markFloorIMSItemsChecked(
  location: string,
  ids: string[]
): Promise<{ success: boolean; updated: number }> {
  const service = getService(location);
  const allItems = await service.getAll();
  let updated = 0;

  for (const id of ids) {
    const item = allItems.find((i) => String(i.id).trim() === String(id).trim());
    if (!item) continue;
    if (String(item.checked_status || "").trim().toUpperCase() === "CHECKED") continue;

    const success = await service.update(id, {
      ...item,
      checked_status: "CHECKED",
    });
    if (success) updated++;
  }

  return { success: updated > 0, updated };
}
