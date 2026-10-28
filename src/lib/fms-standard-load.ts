import { getI2RPackingItems, getI2RPackingStepConfig } from "@/lib/i2r-packing-sheets";
import { getItemReceivePackingItems, getItemReceivePackingStepConfig } from "@/lib/item-receive-packing-sheets";
import { getReplaceItems, getReplaceStepConfig } from "@/lib/replace-sheets";
import { getServiceForModule, getHrmsStepConfig } from "@/lib/hrms-sheets";
import { getStepCount } from "@/lib/hrms-fields";
import { getNewLaunches, getNewLaunchConfig } from "@/lib/new-launch-sheets";
import { mergeStepConfig, doerFor } from "@/lib/new-launch-steps";
import { getChecklistsPaginated } from "@/lib/checklist-sheets";
import {
  readPacking, readItemReceive, readReplace, readHr, readLaunch, readChecklist,
  type StdKey, type StdItem,
} from "@/lib/fms-standard";
import type { HrmsModuleType } from "@/types/hrms";

const keep = (xs: (StdItem | null)[]) => xs.filter((x): x is StdItem => !!x);

/** Reads one process's records from its sheet, in the standard shape. */
export async function loadStd(key: StdKey): Promise<StdItem[]> {
  switch (key) {
    case "i2r-packing": {
      const [items, cfg] = await Promise.all([getI2RPackingItems(), getI2RPackingStepConfig()]);
      return keep(items.map((r) => readPacking(r, cfg)));
    }
    case "item-receive-packing": {
      const [items, cfg] = await Promise.all([getItemReceivePackingItems(), getItemReceivePackingStepConfig()]);
      return keep(items.map((r) => readItemReceive(r, cfg)));
    }
    case "replace": {
      const [items, cfg] = await Promise.all([getReplaceItems(), getReplaceStepConfig()]);
      return keep(items.map((r) => readReplace(r, cfg)));
    }
    case "recruitment":
    case "candidate":
    case "sales":
    case "onboard":
    case "offboard": {
      const m = key as HrmsModuleType;
      const [items, cfg] = await Promise.all([getServiceForModule(m).getAll(), getHrmsStepConfig(m)]);
      const total = getStepCount(m);
      return keep((items as any[]).map((r) => readHr(key, r, total, cfg)));
    }
    case "new-launch": {
      const [items, cfg] = await Promise.all([getNewLaunches(), getNewLaunchConfig().catch(() => [])]);
      const steps = mergeStepConfig(cfg);
      return keep(items.map((r) => readLaunch(r, steps, (n, fields) => (steps[n - 1] ? doerFor(steps[n - 1], fields) : ""))));
    }
    case "checklists": {
      const page: any = await getChecklistsPaginated(
        1, 100000, "", [], "All", "", "ADMIN",
        [], "", "", [], [], [], [], [], [],
        "due_date", "desc", "tasks"
      );
      return keep((page?.data || []).map(readChecklist));
    }
  }
}
