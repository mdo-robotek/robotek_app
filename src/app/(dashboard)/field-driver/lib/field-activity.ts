import type { ActivityEvent, FieldDriverRecord, LiveCoords, LivePing } from '../types/field-driver';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function buildActivityEvents(
  todayRecord: FieldDriverRecord | null,
  liveLocation: LiveCoords | null,
  liveAddress: string | null,
  pathPings: LivePing[]
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  if (todayRecord?.inTime) {
    events.push({
      id: 'journey-started',
      type: 'journey_started',
      title: 'Journey Started',
      time: formatTime(todayRecord.inTime),
      detail: todayRecord.inLocation || undefined,
    });
    events.push({
      id: 'check-in',
      type: 'check_in',
      title: 'Check-in Completed',
      time: formatTime(todayRecord.inTime),
      detail: todayRecord.inLocation || undefined,
    });
  }

  if (pathPings.length > 0) {
    const last = pathPings[pathPings.length - 1];
    events.push({
      id: 'live-location',
      type: 'live_location',
      title: 'Live Location',
      time: formatTime(last.time),
      detail: liveAddress || `Lat: ${parseFloat(last.lat).toFixed(4)}, Lng: ${parseFloat(last.lng).toFixed(4)}`,
    });
  } else if (liveLocation) {
    events.push({
      id: 'live-location',
      type: 'live_location',
      title: 'Live Location',
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      detail: liveAddress || `Lat: ${liveLocation.lat.toFixed(4)}, Lng: ${liveLocation.lng.toFixed(4)}`,
    });
  }

  if (todayRecord?.outTime) {
    events.push({
      id: 'check-out',
      type: 'check_out',
      title: 'Check-out Completed',
      time: formatTime(todayRecord.outTime),
      detail: todayRecord.outLocation || undefined,
    });
  }

  return events.reverse();
}
