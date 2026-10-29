import { FollowUp } from '@/types/sales';
import { ChatBubbleLeftRightIcon, CheckCircleIcon, CalendarIcon } from '@heroicons/react/24/outline';

interface EventTimelineProps {
  followUps: FollowUp[];
  selectedDate: Date | null;
}

export default function EventTimeline({ followUps, selectedDate }: EventTimelineProps) {
  // Filter and sort follow-ups
  const timelineEvents = followUps
    .filter(fu => {
      if (!selectedDate) return true;
      const d1 = new Date(fu.timestamp || fu.next_follow_up_date || '');
      if (isNaN(d1.getTime())) return true;
      return (
        d1.getFullYear() === selectedDate.getFullYear() &&
        d1.getMonth() === selectedDate.getMonth() &&
        d1.getDate() === selectedDate.getDate()
      );
    })
    .sort((a, b) => {
      const d1 = new Date(a.timestamp || 0).getTime();
      const d2 = new Date(b.timestamp || 0).getTime();
      return d2 - d1; // newest first
    });

  if (followUps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center bg-[#FFFFFF] dark:bg-navy-900 rounded-2xl border border-dashed border-[#E5E7EB] dark:border-white/10">
        <div className="w-12 h-12 bg-[#F7F8FA] dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3">
          <ChatBubbleLeftRightIcon className="w-6 h-6 text-[#D97706] dark:text-gray-500" />
        </div>
        <p className="text-[13px] font-semibold text-[#5B6472]">No Events Found</p>
        <p className="text-[14px] text-gray-500 mt-1">Start by logging a follow-up for this lead.</p>
      </div>
    );
  }

  if (timelineEvents.length === 0 && selectedDate) {
    return (
      <div className="text-center py-8 bg-[#FFFFFF] dark:bg-navy-900 rounded-2xl border border-[#E5E7EB] dark:border-white/10">
        <p className="text-[13px] font-semibold text-[#5B6472]">No Events on selected date</p>
      </div>
    );
  }

  return (
    <div className="relative border-l-2 border-[#E5E7EB] dark:border-zinc-800 ml-4 space-y-8 pb-4">
      {timelineEvents.map((event, idx) => {
        const isLatest = idx === 0 && !selectedDate; // Just for visual flair

        return (
          <div key={event.id || idx} className="relative pl-6">
            {/* Timeline Node */}
            <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-2 bg-white dark:bg-navy-900 flex items-center justify-center ${isLatest ? 'border-[#2563EB]' : 'border-[#E5E7EB] dark:border-zinc-700'}`}>
              <div className={`w-2 h-2 rounded-full ${isLatest ? 'bg-[#2563EB] animate-pulse' : 'bg-[#FEF3C7] dark:bg-zinc-700'}`} />
            </div>

            {/* Event Card */}
            <div className="bg-[#FFFFFF] dark:bg-navy-900 p-4 rounded-2xl shadow-sm border border-[#E5E7EB] dark:border-white/5 transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[13px] font-semibold   ${
                    event.status?.toLowerCase().includes('billing') 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : event.status?.toLowerCase().includes('lost') || event.status?.toLowerCase().includes('not')
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#60A5FA]/10 dark:text-[#60A5FA]'
                  }`}>
                    {event.status || 'Status Not Provided'}
                  </span>
                  {isLatest && <span className="text-[14px] font-semibold text-[#2563EB] bg-[#2563EB]/10 px-1.5 rounded">Latest</span>}
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-[#5B6472]">
                    {event.timestamp ? new Date(event.timestamp).toLocaleString("en-GB", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "—"}
                  </p>
                </div>
              </div>

              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 my-3 bg-white dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                {event.remark || <span className="text-[#5B6472] italic">No remark provided.</span>}
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-[#E5E7EB] dark:border-white/5">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  <span className="text-[13px] font-semibold">By: {event.dealing_with || event.ss_name || 'Unknown'}</span>
                </div>
                
                {event.next_follow_up_date && (
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span className="text-[13px] font-semibold">Next: {new Date(event.next_follow_up_date).toLocaleString("en-GB", { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  </div>
                )}

                {event.billing_amount && (
                  <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 ml-auto">
                    <span className="text-[13px] font-semibold">Billed: ₹{event.billing_amount}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
