import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { o2dService, getPendingStepIdx } from "@/lib/o2d-sheets";
import { getPdfText } from "@/lib/google-drive";
import { compare, orderItems, parseCheck, parseSoText, partyLooksSame, plannedAfter, type SoCheck } from "@/lib/so-check";
import { pairAnswer, savePair } from "@/lib/so-party-names";
import { parseHold } from "@/lib/o2d-hold";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fileIdOf = (v: string) => {
  const s = String(v || "").trim();
  return s.match(/\/d\/([A-Za-z0-9_-]{10,})/)?.[1] || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/)?.[1] || (/^[A-Za-z0-9_-]{10,}$/.test(s) ? s : "");
};

/**
 * POST /api/o2d/so-check { orderNo, force? }            → read the SO PDF and compare with the order
 * POST /api/o2d/so-check { orderNo, party: "yes"|"no" } → CRM confirms the SO party once
 * When everything matches and the order is at Step 2, Step 2 is completed by the system.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const me = (session?.user as any)?.username || "";
  if (!session?.user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { orderNo, force, party } = await req.json().catch(() => ({}));
  if (!orderNo || !/^[A-Za-z0-9-]{3,30}$/.test(String(orderNo))) return NextResponse.json({ error: "Order number missing" }, { status: 400 });

  try {
    const rows = (await o2dService.getAll()).filter((r) => String(r.order_no).trim() === String(orderNo).trim());
    if (!rows.length) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const f = rows[0] as any;
    const fileId = fileIdOf(f.upload_so_1);
    if (!fileId) return NextResponse.json({ check: null, note: "No SO file uploaded yet" });

    const old = parseCheck(f.so_check);

    // CRM answers the one-time party question
    if (party === "yes" || party === "no") {
      if (!old?.soParty) return NextResponse.json({ error: "Check the SO first" }, { status: 400 });
      await savePair(f.party_name, old.soParty, old.gstin, party === "yes", me);
    } else if (old && old.file === fileId && !force) {
      return NextResponse.json({ check: old });
    }

    const text = await getPdfText(fileId);
    const so = parseSoText(text);
    const answer = partyLooksSame(f.party_name, so.party) ? true : await pairAnswer(f.party_name, so.party, so.gstin);
    const res = compare(orderNo, f.party_name, f.so_number_1 || "", orderItems(rows), so, answer === true);
    if (answer === false && res.status !== "error") {
      res.status = "diff";
      res.diffs = [...res.diffs.filter((d) => d.kind !== "party"), { kind: "party", order: f.party_name, so: so.party }];
      res.note = "This party name on the SO was marked as wrong";
    }
    const check: SoCheck = { v: 1, at: new Date().toISOString(), file: fileId, ...res };

    // All good and waiting at Step 2 → the system completes Step 2
    const step = getPendingStepIdx(rows);
    if (check.status === "ok" && step === 2 && !parseHold(f.hold) && !parseHold(f.cancelled)) {
      const now = new Date();
      const tat = (await o2dService.getStepConfig().catch(() => []))[2]?.tat || "24 Hrs";
      check.auto = true;
      const json = JSON.stringify(check);
      for (const r of rows) {
        await o2dService.update(r.id, {
          ...r,
          actual_2: now.toISOString(),
          status_2: "Yes",
          planned_3: plannedAfter(now, tat),
          so_check: json,
          updated_at: now.toISOString(),
        } as any);
      }
      return NextResponse.json({ check, completed: true });
    }

    await o2dService.updateOrderColumn(orderNo, "so_check", JSON.stringify(check));
    return NextResponse.json({ check, completed: false });
  } catch (e: any) {
    console.error("so-check failed", e);
    return NextResponse.json({ error: "Couldn't check the SO right now" }, { status: 500 });
  }
}
