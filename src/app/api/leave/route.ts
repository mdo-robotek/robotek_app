import { NextRequest, NextResponse } from "next/server";
import { formatDateMMM } from "@/lib/dateUtils";
import { leaveRequestService, leaveRemarkService, type LeaveRequest, type LeaveRemark } from "@/lib/leave-sheets";
import { globalCache } from "@/lib/cache";
import { invalidateLeavePendingCache, invalidateDashboardCache } from "@/lib/sheet-cache-keys";
import { sendLeaveNotification } from "@/lib/leave-notifications";
import { ownsLeaveFollowUp } from "@/lib/leave-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function bustLeaveCaches() {
  invalidateLeavePendingCache();
  invalidateDashboardCache();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const username = searchParams.get('username');
    const designation = searchParams.get('designation');
    const type = searchParams.get('type');
    const leaveId = searchParams.get('leaveId');

    if (searchParams.get("summary") === "pending") {
      const cacheKey = "leave_pending_count";
      const cached = globalCache.get<number>(cacheKey);
      if (cached !== null) {
        return NextResponse.json({ count: cached });
      }
      const allLeaves = await leaveRequestService.getAll();
      const count = allLeaves.filter((l) => (l.status || "").toLowerCase() === "pending").length;
      globalCache.set(cacheKey, count, 2 * 60 * 1000);
      return NextResponse.json({ count });
    }

    if (type === 'remarks' && leaveId) {
      const allRemarks = await leaveRemarkService.getAll();
      const remarks = allRemarks.filter(r => r.leaveId === leaveId);
      return NextResponse.json({ remarks });
    }

    const allLeaves = await leaveRequestService.getAll();
    let leaves = allLeaves;

    const roleUpper = (role || '').toUpperCase();
    const isAdminOrEA = roleUpper === 'ADMIN' || roleUpper === 'EA';
    const isLeavePC = ownsLeaveFollowUp({ username, role, designation });

    // Admin / EA / PC (e.g. Vandana on User role) see all org leaves
    if (!isAdminOrEA && !isLeavePC && userId) {
      leaves = allLeaves.filter((l) => 
        String(l.userId) === String(userId) || 
        String(l.responsibility1) === String(userId) ||
        String(l.responsibility2) === String(userId) ||
        String(l.responsibility3) === String(userId)
      );
    }

    return NextResponse.json({ leaves });
  } catch (error) {
    console.error("GET Leave Error:", error);
    return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { action, userId, userName, leaveId, status, comment, responsibility1, responsibility2, responsibility3, acceptedBy, leaveType, halfDaySession, tasks1, tasks2, tasks3, sharedTask } = data;

    if (action === 'UPDATE_STATUS') {
      if (!leaveId || !status) return NextResponse.json({ error: "Missing data" }, { status: 400 });
      
      const allLeaves = await leaveRequestService.getAll();
      const lv = allLeaves.find(l => l.id === leaveId);
      if (!lv) throw new Error("Leave not found");

      await leaveRequestService.update(leaveId, { ...lv, status });
      bustLeaveCaches();
      
      // Fire notification in background
      sendLeaveNotification('UPDATE_STATUS', { ...lv, status }, { status }).catch(console.error);
      
      return NextResponse.json({ success: true });

    } else if (action === 'ACCEPT_RESPONSIBILITY') {
        if (!leaveId || !acceptedBy) return NextResponse.json({ error: "Missing data" }, { status: 400 });

        const which: number | undefined = data.which ? Number(data.which) : undefined;

        const allLeaves = await leaveRequestService.getAll();
        const lv = allLeaves.find(l => l.id === leaveId);
        if (!lv) throw new Error("Leave not found");

        const now = new Date().toISOString();
        const updated: any = { ...lv, status: "Pending" };
        if (which && [1,2,3].includes(which)) {
          updated[`acceptedBy${which}`] = acceptedBy;
          updated[`acceptedAt${which}`] = now;
        } else {
          updated.acceptedBy = acceptedBy;
          updated.updatedAt = now;
        }

        await leaveRequestService.update(leaveId, updated);
        
        // Fire notification in background
        sendLeaveNotification('ACCEPT_RESPONSIBILITY', updated, { acceptedBy }).catch(console.error);
        
        return NextResponse.json({ success: true });

    } else if (action === 'ADD_REMARK') {
      if (!leaveId || !comment) return NextResponse.json({ error: "Missing data" }, { status: 400 });
      const newRemark: LeaveRemark = {
        id: `REM-${Date.now()}`,
        leaveId,
        userName: userName || "Unknown",
        comment,
        createdAt: new Date().toISOString()
      };
      await leaveRemarkService.add(newRemark);
      
      // Fire notification in background
      const allLeaves = await leaveRequestService.getAll();
      const lv = allLeaves.find(l => l.id === leaveId);
      if (lv) {
        sendLeaveNotification('ADD_REMARK', lv, { comment }).catch(console.error);
      }
      
      return NextResponse.json({ success: true });

    } else {
      // Create new leave request
      const { startDate, endDate, reason } = data;
      if (!userId || !startDate || !endDate || !reason) return NextResponse.json({ error: "Missing data" }, { status: 400 });

      const newLeave: LeaveRequest = {
        id: `LV-${Date.now()}`,
        userId: String(userId),
        userName: userName || "Unknown",
        leaveType: leaveType || "Full Day",
        halfDaySession: halfDaySession || "",
        startDate,
        endDate,
        reason,
        status: "Pending",
        responsibility1: responsibility1 || "",
        responsibility2: responsibility2 || "",
        responsibility3: responsibility3 || "",
        tasks1: tasks1 || "",
        tasks2: tasks2 || "",
        tasks3: tasks3 || "",
        sharedTask: sharedTask || "",
        acceptedBy: "",
        updatedAt: new Date().toISOString()
      };

      // Ensure canonical columns exist in the sheet before appending.
      // This avoids blank cells when headers were renamed or the header cache is stale.
      const canonical = [
        'id','userId','userName','leaveType','halfDaySession','startDate','endDate','reason','status',
        'responsibility1','responsibility2','responsibility3','tasks1','tasks2','tasks3','sharedTask',
        'acceptedBy','acceptedBy1','acceptedAt1','acceptedBy2','acceptedAt2','acceptedBy3','acceptedAt3','createdAt','updatedAt'
      ];
      try {
        await (leaveRequestService as any).ensureColumns(canonical);
      } catch (e) {
        // Non-fatal: log and continue — add will still attempt to append using current header map
        console.warn('ensureColumns failed for Leave sheet', e);
      }

      await leaveRequestService.add(newLeave);
      bustLeaveCaches();

      // Fire notification in background
      sendLeaveNotification('CREATE', newLeave).catch(console.error);

      return NextResponse.json({ success: true, leave: newLeave });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
    try {
        const data = await req.json();
        const { leaveId, ...updates } = data;
        if (!leaveId) return NextResponse.json({ error: "Missing leaveId" }, { status: 400 });

        const allLeaves = await leaveRequestService.getAll();
        const lv = allLeaves.find(l => l.id === leaveId);
        if (!lv) throw new Error("Leave not found");

        const updated = { ...lv, ...updates };
        await leaveRequestService.update(leaveId, updated);

        // Fire notification in background
        sendLeaveNotification('UPDATE', updated).catch(console.error);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const leaveId = searchParams.get('leaveId');
        if (!leaveId) return NextResponse.json({ error: "Missing leaveId" }, { status: 400 });

        const allLeaves = await leaveRequestService.getAll();
        const lv = allLeaves.find(l => l.id === leaveId);
        if (!lv) throw new Error("Leave not found");

        await leaveRequestService.delete(leaveId);

        // Delete associated remarks
        const allRemarks = await leaveRemarkService.getAll();
        const targetRemarks = allRemarks.filter(r => r.leaveId === leaveId);
        for (const rem of targetRemarks) {
            await leaveRemarkService.delete(rem.id);
        }

        // Fire notification in background before deletion completes, so we still have the object
        sendLeaveNotification('DELETE', lv).catch(console.error);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
    }
}
