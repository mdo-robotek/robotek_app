/**
 * One-off: mark all checklist task occurrences as Completed through TODAY (2026-10-08).
 * Usage: npx tsx --env-file=.env.local scripts/complete-checklists-through-today.ts
 */
import {
  getChecklists,
  getAllChecklistRevisions,
  expandChecklistOccurrences,
} from "../src/lib/checklist-sheets";
import { getUsers } from "../src/lib/google-sheets";
import { getSheetsClient } from "../src/lib/sheet-utils";
import { toDateOnlyString } from "../src/lib/dateUtils";

const TODAY = "2026-10-08";
const SPREADSHEET_ID = "1RG5I4QET9WLjKmSeGCzsbmgraMDH-HXZHfWcOprPBA0";
const HISTORY_SHEET = "checklists_revision_history";
const BATCH = 400;

function masterGroupId(m: { group_id?: string; id: string }) {
  return String(m.group_id || `chk_${m.id}`).trim();
}

function completionKey(gid: string, due: string) {
  return `${gid}|${toDateOnlyString(due)}`;
}

async function main() {
  console.log(`Completing all checklist occurrences through ${TODAY}...`);

  const [masters, users, revisions] = await Promise.all([
    getChecklists(),
    getUsers(),
    getAllChecklistRevisions(),
  ]);

  const officeByUser = new Map<string, string>();
  users.forEach((u) => {
    const name = String(u.username || "").trim();
    if (name) officeByUser.set(name, String(u.office || ""));
  });

  const alreadyDone = new Set<string>();
  for (const r of revisions) {
    if (String(r.new_status || "").toLowerCase() !== "completed") continue;
    const gid = String(r.group_id || "").trim();
    const due = toDateOnlyString(r.due_date);
    if (gid && due) alreadyDone.add(completionKey(gid, due));
  }

  const maxId = revisions.reduce((max, r) => {
    const n = parseInt(String(r.id), 10) || 0;
    return n > max ? n : max;
  }, 0);

  const toComplete: { group_id: string; due_date: string }[] = [];
  for (const master of masters) {
    const gid = masterGroupId(master);
    const office = officeByUser.get(String(master.assigned_to || "").trim());
    const dates = expandChecklistOccurrences(master, TODAY, office);
    for (const due of dates) {
      if (due > TODAY) continue;
      const key = completionKey(gid, due);
      if (alreadyDone.has(key)) continue;
      alreadyDone.add(key);
      toComplete.push({ group_id: gid, due_date: due });
    }
  }

  console.log(`Masters: ${masters.length}`);
  console.log(`Existing history rows: ${revisions.length}`);
  console.log(`New completions to write: ${toComplete.length}`);

  if (toComplete.length === 0) {
    console.log("Nothing to do — everything through today is already completed.");
    return;
  }

  const sheets = await getSheetsClient();
  let nextId = maxId + 1;
  let written = 0;

  for (let i = 0; i < toComplete.length; i += BATCH) {
    const chunk = toComplete.slice(i, i + BATCH);
    const values = chunk.map((item) => {
      const id = String(nextId++);
      return [item.group_id, id, "Completed", item.due_date, TODAY];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HISTORY_SHEET}!A:E`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    written += chunk.length;
    console.log(`Wrote ${written}/${toComplete.length}`);
  }

  console.log(`Done. Marked ${written} occurrence(s) Completed through ${TODAY}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
