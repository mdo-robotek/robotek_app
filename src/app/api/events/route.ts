export const dynamic = 'force-dynamic';

import { delegationService } from '@/lib/delegation-sheets';
import { ticketService } from '@/lib/ticket-sheets';
import { imsService } from '@/lib/ims-sheets';
import { i2rService } from '@/lib/i2r-sheets';
import { partyManagementService } from '@/lib/party-management-sheets';
import { checklistService } from '@/lib/checklist-sheets';

import { o2dService } from '@/lib/o2d-sheets';
import { o2dkbService } from '@/lib/o2dkb-sheets';
import { replaceService } from '@/lib/replace-sheets';
import { i2rPackingService } from '@/lib/i2r-packing-sheets';
import { itemReceivePackingService } from '@/lib/item-receive-packing-sheets';

// Map module names to their sheet services (all extend BaseSheetsService)
const SERVICES: Record<string, any> = {
  delegations: delegationService,
  tickets: ticketService,
  ims: imsService,
  i2r: i2rService,
  'party-management': partyManagementService,
  checklists: checklistService,
  o2d: o2dService,
  o2dkb: o2dkbService,
  replace: replaceService,
  'i2r-packing': i2rPackingService,
  'item-receive-packing': itemReceivePackingService,
};

/**
 * SSE endpoint — Lambda-safe design:
 * 1. Client connects with ?modules=...&counts={...}&timestamps={...}
 *    (last known row counts AND last-modified timestamps per module)
 * 2. Server reads the ID column (for count) AND the meta cell (last-modified timestamp)
 * 3. If EITHER the row count OR the timestamp changed → sends a "change" event
 *    This means field-level edits (status changes, date updates) are now detected!
 * 4. Closes the stream immediately (Lambda-safe — no long-lived connections)
 * 5. Client's onerror handler reconnects after 15s with updated state
 *
 * Data savings: on unchanged data, response is ~100 bytes instead of 300KB.
 * Full data is only fetched by the client when a "change" event is received.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modulesParam = searchParams.get('modules') || '';
  const countsParam = searchParams.get('counts') || '{}';
  const timestampsParam = searchParams.get('timestamps') || '{}';

  const requestedModules = modulesParam.split(',').filter((m) => m in SERVICES);
  let lastCounts: Record<string, number> = {};
  let lastTimestamps: Record<string, number> = {};
  try { lastCounts = JSON.parse(countsParam); } catch { lastCounts = {}; }
  try { lastTimestamps = JSON.parse(timestampsParam); } catch { lastTimestamps = {}; }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const results = await Promise.all(
          requestedModules.map(async (mod) => {
            const service = SERVICES[mod];
            const lastTime = lastTimestamps[mod] || 0;
            const lastCount = lastCounts[mod] || 0;

            try {
              const lastModified = await service.getLastModified();
              
              // 1. Initial Sync: If client has no baseline, don't send upserts.
              // Just return the current timestamp/count so they have a baseline for next time.
              if (lastTime === 0) {
                const currentIds = await service.getLatestIds();
                return { mod, changed: false, lastModified, count: currentIds.length };
              }

              // 2. Quick Check: Has anything changed at all?
              if (lastModified > 0 && lastModified <= lastTime) {
                // No changes based on meta-cell
                return { mod, changed: false, lastModified, count: lastCount };
              }

              // 3. Fetch changes (Upserts + Current IDs)
              const sinceStr = new Date(lastTime).toISOString();
              const { upserts, currentIds, timestamp } = await service.getChanges(sinceStr);
              const newCount = currentIds.length;
              const newTime = new Date(timestamp).getTime();

              const countChanged = lastCount !== newCount;
              const hasUpserts = upserts.length > 0;

              if (countChanged || hasUpserts) {
                return { 
                  mod, 
                  changed: true, 
                  upserts: upserts.slice(0, 100), // Cap upserts in one SSE burst to 100 for stability
                  currentIds, 
                  count: newCount, 
                  lastModified: newTime 
                };
              }

              return { mod, changed: false, lastModified: newTime, count: newCount };
            } catch (err) {
              console.error(`SSE Error for module ${mod}:`, err);
              return { mod, changed: false, lastModified: lastTime, count: lastCount };
            }
          })
        );

        const newCounts: Record<string, number> = {};
        const newTimestamps: Record<string, number> = {};
        const incremental: any[] = [];

        for (const res of results) {
          newCounts[res.mod] = res.count;
          newTimestamps[res.mod] = res.lastModified;

          if (res.changed) {
            incremental.push({
              module: res.mod,
              upserts: res.upserts,
              currentIds: res.currentIds,
            });
          }
        }

        const eventType = incremental.length > 0 ? 'change' : 'heartbeat';
        const payload = JSON.stringify({
          incremental,
          counts: newCounts,
          timestamps: newTimestamps,
        });

        // SAFETY: Only enqueue if controller is not closed
        controller.enqueue(
          encoder.encode(`retry: 15000\nevent: ${eventType}\ndata: ${payload}\n\n`)
        );
      } catch (err) {
        if (err instanceof Error && err.message.includes("closed")) return;
        console.error("SSE Stream Error:", err);
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no', // Disable nginx buffering on Amplify
    },
  });
}
