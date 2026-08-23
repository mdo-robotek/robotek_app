'use client';

import { useEffect } from 'react';
import type { FieldStatus, FieldUser, LiveCoords } from '../types/field-driver';

export function useLiveSync(
  currentStatus: FieldStatus,
  user: FieldUser | null,
  liveLocation: LiveCoords | null
) {
  useEffect(() => {
    if (currentStatus !== 'CHECKED_IN' || !user || !liveLocation) return;

    const syncLocation = async () => {
      try {
        await fetch('/api/field-driver/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            userName: user.username,
            lat: liveLocation.lat,
            lng: liveLocation.lng,
          }),
        });
      } catch (e) {
        console.error('Failed to sync live location', e);
      }
    };

    syncLocation();
    const intervalId = setInterval(syncLocation, 60000);
    return () => clearInterval(intervalId);
  }, [currentStatus, user, liveLocation]);
}
