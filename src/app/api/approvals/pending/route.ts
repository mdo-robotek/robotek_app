import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsers } from "@/lib/google-sheets";
import { leaveRequestService } from "@/lib/leave-sheets";
import { getIMSGFloorApprovals } from "@/lib/ims-gfloor-approval-sheets";
import { paymentVendorService } from "@/lib/payment-vendor-sheets";
import { getTickets } from "@/lib/ticket-sheets";
import { helpTicketsFor } from "@/lib/help-tickets";
import {
  approvalsForUser,
  isPendingStatus,
  type ApprovalKey,
} from "@/lib/approval-routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ApprovalGroup {
  key: ApprovalKey | "help-tickets";
  title: string;
  href: string;
  count: number;
  oldestDays: number | null;
  /** Items past their promised date (help tickets only). */
  late?: number;
  /** Button text; defaults to "Review" on the card. */
  action?: string;
  samples: { label: string; sub: string }[];
}

const daysSince = (raw: string): number | null => {
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

export async function GET() {
  try {
    const session = await auth();
    const sessionUser = session?.user as { username?: string } | undefined;
    const username = sessionUser?.username || "";
    if (!username) {
      return NextResponse.json({ groups: [], total: 0 });
    }

    const users = await getUsers();
    const me = users.find(
      (u) => String(u.username).trim().toLowerCase() === username.trim().toLowerCase()
    );

    // Someone who has left the company (inactive in the Users sheet) owns
    // nothing, even if their designation still says HR / PC.
    if (me && me.isActive === false) {
      return NextResponse.json({ groups: [], total: 0 });
    }

    const mine = approvalsForUser({
      username,
      designation: me?.designation || "",
    });

    const wanted = new Set(mine.map((d) => d.key));
    const groups: ApprovalGroup[] = [];

    try {
      const tickets = helpTicketsFor(await getTickets(), username);
      if (tickets) groups.push(tickets);
    } catch (e) {
      console.error("approvals/pending: tickets failed", e);
    }

    if (wanted.has("leave")) {
      const rows = await leaveRequestService.getAll();
      const pending = rows.filter((r) => isPendingStatus(r.status));
      const days = pending
        .map((r) => daysSince(r.createdAt || r.startDate))
        .filter((d): d is number => d !== null);
      groups.push({
        key: "leave",
        title: "Leave Requests",
        href: "/leave",
        count: pending.length,
        oldestDays: days.length ? Math.max(...days) : null,
        samples: pending.slice(0, 3).map((r) => ({
          label: r.userName || "—",
          sub: `${r.leaveType || "Leave"} · ${r.startDate || ""}`,
        })),
      });
    }

    if (wanted.has("ims-gfloor")) {
      const rows = await getIMSGFloorApprovals();
      const pending = rows.filter((r) => isPendingStatus(r.approval_status));
      const days = pending
        .map((r) => daysSince(r.date))
        .filter((d): d is number => d !== null);
      groups.push({
        key: "ims-gfloor",
        title: "Floor Stock Approval",
        href: "/ims",
        count: pending.length,
        oldestDays: days.length ? Math.max(...days) : null,
        samples: pending.slice(0, 3).map((r) => ({
          label: r.item_name || "—",
          sub: `${r.in_qty || 0} pcs · ${r.date || ""}`,
        })),
      });
    }

    if (wanted.has("payment-vendor")) {
      const rows = await paymentVendorService.getAll();
      const pending = rows.filter((r) => isPendingStatus(r.status));
      groups.push({
        key: "payment-vendor",
        title: "Vendor Payment Approval",
        href: "/payment-vendor-approval",
        count: pending.length,
        oldestDays: null,
        samples: pending.slice(0, 3).map((r) => ({
          label: r.grn_no || "—",
          sub: r.remarks || "Waiting for approval",
        })),
      });
    }

    const withWork = groups.filter((g) => g.count > 0);
    return NextResponse.json({
      groups: withWork,
      total: withWork.reduce((s, g) => s + g.count, 0),
    });
  } catch (error) {
    console.error("approvals/pending failed", error);
    return NextResponse.json({ groups: [], total: 0 });
  }
}
