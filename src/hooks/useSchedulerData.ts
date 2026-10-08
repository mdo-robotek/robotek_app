"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { CalendarEvent, CalendarEventType } from "@/types/calendar";
import { parseDateString } from "@/lib/dateUtils";

export function useSchedulerData() {
  const { data: session } = useSession();
  const [data, setData] = useState<{
    delegations: any[];
    checklists: any[];
    tickets: any[];
    o2d: any[];
    meetings: any[];
    scotCalls: any[];
  }>({
    delegations: [],
    checklists: [],
    tickets: [],
    o2d: [],
    meetings: [],
    scotCalls: [],
  });
  const [loading, setLoading] = useState(true);

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [delRes, checkRes, tickRes, o2dRes, meetRes, scotRes] = await Promise.all([
        fetch("/api/delegations"),
        fetch("/api/checklists?view=tasks&page=1&limit=100000&userRole=ADMIN&assignmentFilter=All"),
        fetch("/api/tickets"),
        fetch("/api/o2d?all=true"),
        fetch("/api/scheduler/meetings"),
        fetch("/api/scot?tab=calls"),
      ]);

      const delJson = delRes.ok ? await delRes.json() : [];
      const checkJson = checkRes.ok ? await checkRes.json() : [];
      const tickJson = tickRes.ok ? await tickRes.json() : [];
      const o2dJson = o2dRes.ok ? await o2dRes.json() : [];
      const meetJson = meetRes.ok ? await meetRes.json() : [];
      const scotJson = scotRes.ok ? await scotRes.json() : [];

      setData({
        delegations: Array.isArray(delJson) ? delJson : delJson.data || [],
        checklists: Array.isArray(checkJson) ? checkJson : checkJson.data || [],
        tickets: Array.isArray(tickJson) ? tickJson : tickJson.data || [],
        o2d: Array.isArray(o2dJson) ? o2dJson : o2dJson.data || [],
        meetings: Array.isArray(meetJson) ? meetJson : meetJson.data || [],
        scotCalls: Array.isArray(scotJson) ? scotJson : scotJson.data || [],
      });
    } catch (error) {
      console.error("Failed to fetch scheduler data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const userRole = (session?.user as any)?.role || "USER";
    const username = (session?.user as any)?.username || "";

    // 1. Delegations
    data.delegations.forEach((d) => {
      const start = parseDateString(d.due_date);
      if (!start) return;
      events.push({
        id: `del-${d.id}`,
        title: d.title,
        description: d.description,
        type: "delegation",
        start,
        status: d.status,
        priority: d.priority,
        assignedTo: d.assigned_to,
        assignedBy: d.assigned_by,
        itemData: d,
      });
    });

    // 2. Checklists (API returns expanded task occurrences by default)
    data.checklists.forEach((c) => {
      const due = c.occurrence_due_date || c.due_date;
      const start = parseDateString(due);
      if (!start) return;
      events.push({
        id: `check-${c.occurrence_key || `${c.id}-${due}`}`,
        title: c.task,
        description: `Department: ${c.department}`,
        type: "checklist",
        start,
        status: c.display_status || c.status || "Pending",
        priority: c.priority,
        assignedTo: c.assigned_to,
        itemData: c,
      });
    });

    // 3. Tickets
    data.tickets.forEach((t) => {
      const start = parseDateString(t.planned_resolution);
      if (!start) return;
      events.push({
        id: `tick-${t.id}`,
        title: t.title,
        description: t.description,
        type: "ticket",
        start,
        status: t.status,
        priority: t.priority,
        assignedTo: t.solver_person,
        assignedBy: t.raised_by,
        itemData: t,
      });
    });

    // 4. O2D (Unique pending tasks per order)
    const seenOrders = new Set<string>();

    data.o2d.forEach((o) => {
      if (!o.order_no || seenOrders.has(o.order_no)) return;

      // Find the first pending step
      let pendingStep = 0;
      for (let i = 1; i <= 11; i++) {
        const s = o[`status_${i}`];
        if (s !== "Yes" && s !== "Done" && s !== "Completed") {
          pendingStep = i;
          break;
        }
      }
      if (pendingStep === 0) return;

      const plannedDateStr = o[`planned_${pendingStep}`];
      if (!plannedDateStr) return;

      const start = parseDateString(plannedDateStr);
      if (!start) return;

      seenOrders.add(o.order_no); // Mark as mapped so duplicates are ignored

      events.push({
        id: `o2d-${o.id}-${pendingStep}`,
        title: `${o.order_no || "Order"} - Step ${pendingStep}`,
        description: `Customer: ${o.party_name} | Item: ${o.item_name}`,
        type: "o2d",
        start,
        status: o.hold ? "On Hold" : "Pending",
        itemData: o,
      });
    });


    // 5. Meetings
    data.meetings.forEach((m) => {
      const start = parseDateString(m.start_time);
      const end = parseDateString(m.end_time);
      if (!start) return;

      events.push({
        id: `meet-${m.id}`,
        title: m.title,
        description: m.description,
        type: "meeting",
        start,
        end: end || undefined,
        assignedTo: m.attendees,
        assignedBy: m.created_by,
        link: m.meeting_link,
        itemData: m,
      });
    });

    // 6. SCOT Follow Ups
    console.log("SCOT CALLS FETCHED:", data.scotCalls.length);
    data.scotCalls.forEach((call) => {
      let followUpDateStr = call.latestNextDate;
      
      // Compute effective follow-up date logic if missing
      if (!followUpDateStr || followUpDateStr === "-") {
        if (call.lastOrderDate && call.lastOrderDate !== "-" && call.frequencyOfCallingAfterOrderPlaced) {
          const freq = parseInt(call.frequencyOfCallingAfterOrderPlaced);
          if (!isNaN(freq) && freq > 0) {
             const base = new Date(call.lastOrderDate);
             if (!isNaN(base.getTime())) {
                base.setDate(base.getDate() + freq);
                followUpDateStr = base.toISOString().split('T')[0];
             }
          }
        }
      }

      if (!followUpDateStr || followUpDateStr === "-") return;
      const start = parseDateString(followUpDateStr);
      if (!start) return;

      events.push({
        id: `scot-${call.partyName}`,
        title: `Follow Up: ${call.partyName}`,
        description: `Concern Person: ${call.concernPerson || "N/A"}\nMobile: ${call.mobileNum || "N/A"}\nStatus: ${call.latestStatus || "Pending"}`,
        type: "scot",
        start,
        status: call.latestStatus,
        assignedTo: call.concernPerson,
        itemData: call,
      });
    });

    console.log("TOTAL EVENTS AFTER SCOT:", events.filter(e => e.type === "scot").length);

    return events.filter(e => {
        if (e.type === "meeting") return true;
        const statusLower = (e.status || "").toLowerCase();
        if (
          statusLower.includes("completed") || 
          statusLower.includes("closed") || 
          statusLower.includes("approved") ||
          statusLower.includes("resolved")
        ) {
          return false;
        }
        return true;
    });
  }, [data, session]);

  const recentActivity = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);

    const filtered = allEvents.filter((e) => {
      // Exclude resolved tasks
      const isResolved = ['Completed', 'Closed', 'Approved', 'Done', 'Yes'].includes(e.status || "");
      if (isResolved) return false;

      const eventDate = new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate());
      
      // We want items that are Today or Tomorrow
      const isTodayOrTomorrow = eventDate >= today && eventDate < dayAfterTomorrow;
      
      // Or items that are overdue
      const isOverdue = e.start < now;

      return isTodayOrTomorrow || isOverdue;
    });

    return filtered.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [allEvents]);

  return {
    allEvents,
    recentActivity,
    loading,
    refresh: fetchData,
  };
}
